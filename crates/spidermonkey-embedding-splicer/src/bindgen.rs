use crate::{uwrite, uwriteln};
use heck::*;
use js_component_bindgen::function_bindgen::{
    ErrHandling, FunctionBindgen, ResourceData, ResourceMap, ResourceTable,
};
use js_component_bindgen::intrinsics::{render_intrinsics, Intrinsic};
use js_component_bindgen::names::LocalNames;
use js_component_bindgen::source::Source;
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fmt::Write;
use wit_bindgen_core::abi::{self, LiftLower};
use wit_component::StringEncoding;
use wit_parser::abi::{AbiVariant, WasmSignature};
use wit_parser::*;

#[derive(Debug)]
pub enum Resource {
    None,
    Constructor(String),
    Static(String),
    Method(String),
}

impl Resource {
    pub fn canon_string(&self, fn_name: &str) -> String {
        match self {
            Resource::None => fn_name.to_string(),
            Resource::Constructor(name) => format!("[constructor]{name}"),
            Resource::Static(name) => format!("[static]{name}.{fn_name}"),
            Resource::Method(name) => format!("[method]{name}.{fn_name}"),
        }
    }

    fn func_name(&self, fn_name: &str) -> String {
        match self {
            Resource::None => fn_name.to_lower_camel_case(),
            Resource::Constructor(name) => {
                format!(
                    "{}${}",
                    name.to_lower_camel_case(),
                    fn_name.to_lower_camel_case()
                )
            }
            Resource::Method(name) => {
                format!(
                    "{}$method${}",
                    name.to_lower_camel_case(),
                    fn_name.to_lower_camel_case()
                )
            }
            Resource::Static(name) => {
                format!(
                    "{}$static${}",
                    name.to_lower_camel_case(),
                    fn_name.to_lower_camel_case()
                )
            }
        }
    }
}

#[derive(Debug)]
pub struct BindingItem {
    pub iface: bool,
    pub iface_name: Option<String>,
    pub binding_name: String,
    pub resource: Resource,
    pub name: String,
    pub func: CoreFn,
}

struct JsBindgen<'a> {
    /// The source code for the "main" file that's going to be created for the
    /// component we're generating bindings for. This is incrementally added to
    /// over time and primarily contains the main `instantiate` function as well
    /// as a type-description of the input/output interfaces.
    src: Source,

    /// List of all intrinsics emitted to `src` so far.
    all_intrinsics: BTreeSet<Intrinsic>,

    esm_bindgen: EsmBindgen,
    local_names: LocalNames,

    resolve: &'a Resolve,
    world: WorldId,
    sizes: SizeAlign,
    memory: String,
    realloc: String,

    // export "name"
    exports: Vec<(String, BindingItem)>,
    // imports "specifier"
    imports: Vec<(String, BindingItem)>,

    resource_directions: HashMap<TypeId, AbiVariant>,

    imported_resources: BTreeSet<TypeId>,
}

#[derive(Debug)]
pub enum CoreTy {
    I32,
    I64,
    F32,
    F64,
}

#[derive(Debug)]
pub struct CoreFn {
    pub params: Vec<CoreTy>,
    pub ret: Option<CoreTy>,
    pub retptr: bool,
    pub retsize: u32,
    pub paramptr: bool,
}

#[derive(Debug)]
pub struct Componentization {
    pub js_bindings: String,
    pub exports: Vec<(String, BindingItem)>,
    pub imports: Vec<(String, BindingItem)>,
    pub import_wrappers: Vec<(String, String)>,
    pub resource_imports: Vec<(String, String, u32)>,
}

pub fn componentize_bindgen(resolve: &Resolve, id: WorldId, name: &str) -> Componentization {
    let mut bindgen = JsBindgen {
        src: Source::default(),
        esm_bindgen: EsmBindgen::default(),
        local_names: LocalNames::default(),
        all_intrinsics: BTreeSet::new(),
        resolve,
        world: id,
        sizes: SizeAlign::default(),
        memory: "$memory".to_string(),
        realloc: "$realloc".to_string(),
        exports: Vec::new(),
        imports: Vec::new(),
        resource_directions: HashMap::new(),
        imported_resources: BTreeSet::new(),
    };

    bindgen.sizes.fill(resolve);

    bindgen
        .local_names
        .exclude_globals(Intrinsic::get_global_names());

    bindgen.imports_bindgen();

    bindgen.exports_bindgen();
    bindgen.esm_bindgen.populate_export_aliases();

    // consolidate import specifiers and generate wrappers
    // we do this separately because function index order matters
    let mut import_bindings = Vec::new();
    for (_, item) in bindgen.imports.iter() {
        // this import binding order matters
        import_bindings.push(binding_name(
            &item.resource.func_name(&item.name),
            &item.iface_name,
        ));
    }

    let by_specifier_by_resource = bindgen.imports.iter().fold(
        BTreeMap::<_, BTreeMap<_, Vec<_>>>::new(),
        |mut map, (specifier, item)| {
            map.entry(specifier)
                .or_default()
                .entry(match &item.resource {
                    Resource::None => None,
                    Resource::Method(name)
                    | Resource::Static(name)
                    | Resource::Constructor(name) => Some(name),
                })
                .or_default()
                .push(item);
            map
        },
    );

    let mut import_wrappers = Vec::new();
    for (specifier, by_resource) in by_specifier_by_resource {
        let mut specifier_list = Vec::new();
        for (resource, items) in by_resource {
            let item = items.iter().next().unwrap();
            if let Some(resource) = resource {
                let export_name = resource.to_upper_camel_case();
                let binding_name = binding_name(&export_name, &item.iface_name);
                if item.iface {
                    specifier_list.push(format!("import_{binding_name} as {export_name}"));
                } else {
                    specifier_list.push(format!("import_{binding_name} as default"));
                }
            } else {
                for BindingItem {
                    iface,
                    iface_name,
                    name,
                    ..
                } in items
                {
                    let export_name = name.to_lower_camel_case();
                    let binding_name = binding_name(&export_name, iface_name);
                    if *iface {
                        specifier_list.push(format!("import_{binding_name} as {export_name}"));
                    } else {
                        specifier_list.push(format!("import_{binding_name} as default"));
                    }
                }
            }
        }
        let joined_bindings = specifier_list.join(", ");
        import_wrappers.push((
            specifier.to_string(),
            format!("export {{ {joined_bindings} }} from 'internal:bindings';"),
        ));
    }

    let mut resource_bindings = Vec::new();
    let mut resource_imports = Vec::new();
    let mut finalization_registries = Vec::new();
    for (key, export) in &resolve.worlds[id].exports {
        let key_name = resolve.name_world_key(key);
        if let WorldItem::Interface(iface_id) = export {
            let iface = &resolve.interfaces[*iface_id];
            for ty_id in iface.types.values() {
                let ty = &resolve.types[*ty_id];
                if let TypeDefKind::Resource = &ty.kind {
                    let iface_prefix = interface_name(resolve, *iface_id)
                        .map(|s| format!("{s}$"))
                        .unwrap_or_else(String::new);
                    let resource_name = ty.name.as_ref().unwrap().to_lower_camel_case();
                    let module_name = format!("[export]{key_name}");
                    resource_bindings.push(format!("{iface_prefix}new${resource_name}"));
                    resource_imports.push((
                        module_name.clone(),
                        format!("[resource-new]{resource_name}"),
                        1,
                    ));
                    resource_bindings.push(format!("{iface_prefix}rep${resource_name}"));
                    resource_imports.push((
                        module_name.clone(),
                        format!("[resource-rep]{resource_name}"),
                        1,
                    ));
                    resource_bindings.push(format!("export${iface_prefix}drop${resource_name}"));
                    resource_imports.push((
                        module_name.clone(),
                        format!("[resource-drop]{resource_name}"),
                        0,
                    ));
                    finalization_registries.push(format!(
                        "const finalizationRegistry_export${iface_prefix}{resource_name} = \
                         new FinalizationRegistry((handle) => {{
                             $resource_export${iface_prefix}drop${resource_name}(handle);
                         }});
                        "
                    ));
                }
            }
        }
    }

    let mut imported_resource_modules = HashMap::new();
    for (key, import) in &resolve.worlds[id].imports {
        let key_name = resolve.name_world_key(key);
        if let WorldItem::Interface(iface_id) = import {
            let iface = &resolve.interfaces[*iface_id];
            for ty_id in iface.types.values() {
                let ty = &resolve.types[*ty_id];
                if let TypeDefKind::Resource = &ty.kind {
                    imported_resource_modules.insert(*ty_id, key_name.clone());
                }
            }
        }
    }

    for &id in &bindgen.imported_resources {
        let ty = &resolve.types[id];
        let prefix = match &ty.owner {
            TypeOwner::World(_) => todo!("handle resources with world owners"),
            TypeOwner::Interface(id) => interface_name(resolve, *id).map(|s| format!("{s}$")),
            TypeOwner::None => unreachable!(),
        };
        let resource_name = ty.name.as_deref().unwrap();
        let prefix = prefix.as_deref().unwrap_or("");
        let resource_name_camel = resource_name.to_lower_camel_case();

        finalization_registries.push(format!(
            "const finalizationRegistry_import${prefix}{resource_name_camel} = \
             new FinalizationRegistry((handle) => {{
                 $resource_import${prefix}drop${resource_name_camel}(handle);
             }});
            "
        ));
        resource_bindings.push(format!("import${prefix}drop${resource_name_camel}"));
        resource_imports.push((
            imported_resource_modules.get(&id).unwrap().clone(),
            format!("[resource-drop]{resource_name}"),
            0,
        ));
    }

    let finalization_registries = finalization_registries.concat();

    let mut output = Source::default();

    uwrite!(
        output,
        "
            import * as $source_mod from '{name}';

            let repCnt = 0;
            let repTable = new Map();

            let $memory, $realloc{};
            export function $initBindings (_memory, _realloc{}) {{
                $memory = _memory;
                $realloc = _realloc;{}
            }}

            {finalization_registries}
        ",
        import_bindings
            .iter()
            .map(|impt| format!(", $import_{impt}"))
            .chain(
                resource_bindings
                    .iter()
                    .map(|name| format!(", $resource_{name}"))
            )
            .collect::<Vec<_>>()
            .concat(),
        import_bindings
            .iter()
            .chain(&resource_bindings)
            .map(|impt| format!(", _{impt}"))
            .collect::<Vec<_>>()
            .concat(),
        import_bindings
            .iter()
            .map(|impt| format!("\n$import_{impt} = _{impt};"))
            .chain(
                resource_bindings
                    .iter()
                    .map(|name| format!("\n$resource_{name} = _{name}"))
            )
            .collect::<Vec<_>>()
            .concat(),
    );

    bindgen.esm_bindgen.render_export_imports(
        &mut output,
        "$source_mod",
        &mut bindgen.local_names,
        name,
    );

    let js_intrinsics = render_intrinsics(&mut bindgen.all_intrinsics, false, true);
    output.push_str(&js_intrinsics);
    output.push_str(&bindgen.src);

    Componentization {
        js_bindings: output.to_string(),
        exports: bindgen.exports,
        imports: bindgen.imports,
        import_wrappers,
        resource_imports,
    }
}

impl JsBindgen<'_> {
    fn exports_bindgen(&mut self) {
        for (key, export) in &self.resolve.worlds[self.world].exports {
            let name = self.resolve.name_world_key(key);
            match export {
                WorldItem::Function(func) => {
                    let local_name = self.local_names.create_once(&func.name).to_string();
                    self.export_bindgen(
                        name.into(),
                        false,
                        None,
                        &local_name,
                        StringEncoding::UTF8,
                        func,
                    );
                    self.esm_bindgen.add_export_func(
                        None,
                        local_name.to_string(),
                        func.name.to_lower_camel_case(),
                    );
                }
                WorldItem::Interface(id) => {
                    let iface = &self.resolve.interfaces[*id];
                    for id in iface.types.values() {
                        if let TypeDefKind::Resource = &self.resolve.types[*id].kind {
                            self.resource_directions
                                .insert(*id, AbiVariant::GuestExport);
                        }
                    }
                    for (func_name, func) in &iface.functions {
                        let local_name = self
                            .local_names
                            .create_once(&format!("{name}-{func_name}"))
                            .to_string();
                        match &func.kind {
                            FunctionKind::Freestanding => {
                                let name = &name;
                                self.export_bindgen(
                                    name.to_string(),
                                    true,
                                    interface_name(self.resolve, *id),
                                    &local_name,
                                    StringEncoding::UTF8,
                                    &func,
                                );
                                self.esm_bindgen.add_export_func(
                                    Some(&name),
                                    local_name,
                                    func.name.to_lower_camel_case(),
                                );
                            }
                            FunctionKind::Method(ty)
                            | FunctionKind::Static(ty)
                            | FunctionKind::Constructor(ty) => {
                                let name = &name;
                                let ty = &self.resolve.types[*ty];
                                let resource_name = ty.name.as_ref().unwrap().to_upper_camel_case();
                                let local_name = self
                                    .local_names
                                    .get_or_create(
                                        &format!("resource:{resource_name}"),
                                        &resource_name,
                                    )
                                    .0
                                    .to_upper_camel_case();
                                self.export_bindgen(
                                    name.to_string(),
                                    true,
                                    interface_name(self.resolve, *id),
                                    &local_name,
                                    StringEncoding::UTF8,
                                    &func,
                                );
                                self.esm_bindgen.ensure_exported_resource(
                                    Some(&name),
                                    local_name,
                                    resource_name,
                                );
                            }
                        };
                    }
                }

                // ignore type exports for now
                WorldItem::Type(_) => {}
            }
        }
    }

    fn imports_bindgen(&mut self) {
        for (key, impt) in &self.resolve.worlds[self.world].imports {
            let import_name = self.resolve.name_world_key(key);
            match &impt {
                WorldItem::Function(f) => {
                    self.import_bindgen(import_name, f, false, None);
                }
                WorldItem::Interface(i) => {
                    let iface = &self.resolve.interfaces[*i];
                    for id in iface.types.values() {
                        if let TypeDefKind::Resource = &self.resolve.types[*id].kind {
                            self.resource_directions
                                .insert(*id, AbiVariant::GuestImport);
                        }
                    }

                    let by_resource = iface.functions.iter().fold(
                        BTreeMap::<_, Vec<_>>::new(),
                        |mut map, (name, func)| {
                            map.entry(match &func.kind {
                                FunctionKind::Freestanding => None,
                                FunctionKind::Method(ty)
                                | FunctionKind::Static(ty)
                                | FunctionKind::Constructor(ty) => Some(*ty),
                            })
                            .or_default()
                            .push((name, func));
                            map
                        },
                    );

                    let iface_name = interface_name(self.resolve, *i);

                    for (resource, functions) in by_resource {
                        if let Some(ty) = resource {
                            let name = binding_name(
                                &self.resolve.types[ty]
                                    .name
                                    .as_ref()
                                    .unwrap()
                                    .to_upper_camel_case(),
                                &iface_name,
                            );

                            uwriteln!(self.src, "\nexport class import_{name} {{");
                        }

                        for (_, func) in functions {
                            self.import_bindgen(
                                import_name.clone(),
                                func,
                                true,
                                iface_name.clone(),
                            );
                        }

                        if resource.is_some() {
                            uwriteln!(self.src, "}}");
                        }
                    }
                }
                WorldItem::Type(_) => {}
            };
        }
    }

    fn import_bindgen(
        &mut self,
        import_name: String,
        func: &Function,
        iface: bool,
        iface_name: Option<String>,
    ) {
        let fn_name = func.item_name();
        let fn_camel_name = fn_name.to_lower_camel_case();

        use binding_name as binding_name_fn;

        let (binding_name, resource) = match &func.kind {
            FunctionKind::Freestanding => {
                let binding_name = binding_name(&fn_camel_name, &iface_name);

                uwrite!(self.src, "\nexport function import_{binding_name}");

                (binding_name, Resource::None)
            }
            FunctionKind::Method(ty) => {
                let args = (0..(func.params.len() - 1))
                    .map(|n| format!("arg{n}"))
                    .collect::<Vec<_>>()
                    .join(", ");

                uwrite!(self.src, "{fn_camel_name}({args}) {{\nfunction helper");

                (
                    "<<INVALID>>".to_string(),
                    Resource::Method(self.resolve.types[*ty].name.clone().unwrap()),
                )
            }
            FunctionKind::Static(ty) => {
                uwrite!(self.src, "static {fn_camel_name}");
                (
                    "<<INVALID>>".to_string(),
                    Resource::Static(self.resolve.types[*ty].name.clone().unwrap()),
                )
            }
            FunctionKind::Constructor(ty) => {
                uwrite!(self.src, "constructor");
                (
                    "<<INVALID>>".to_string(),
                    Resource::Constructor(self.resolve.types[*ty].name.clone().unwrap()),
                )
            }
        };

        // imports are canonicalized as exports because
        // the function bindgen as currently written still makes this assumption
        self.bindgen(
            func.params.len(),
            &format!(
                "$import_{}",
                binding_name_fn(&resource.func_name(fn_name), &iface_name)
            ),
            StringEncoding::UTF8,
            func,
            AbiVariant::GuestExport,
        );
        self.src.push_str("\n");

        if let FunctionKind::Method(_) = &func.kind {
            let args = (0..(func.params.len() - 1))
                .map(|n| format!(", arg{n}"))
                .collect::<Vec<_>>()
                .concat();

            uwriteln!(self.src, "return helper(this{args});\n}}");
        }

        let sig = self.resolve.wasm_signature(AbiVariant::GuestImport, func);

        let component_item = if let Some(iface_name) = iface_name {
            BindingItem {
                iface,
                binding_name,
                iface_name: Some(iface_name),
                resource,
                name: fn_name.to_string(),
                func: self.core_fn(func, &sig),
            }
        } else {
            BindingItem {
                iface,
                binding_name,
                iface_name: None,
                resource,
                name: fn_name.to_string(),
                func: self.core_fn(func, &sig),
            }
        };

        self.imports.push((import_name, component_item));
    }

    fn create_resource_map(&self, func: &Function) -> ResourceMap {
        let mut resource_map = BTreeMap::new();
        for (_, ty) in func.params.iter() {
            self.iter_resources(ty, &mut resource_map);
        }
        for ty in func.results.iter_types() {
            self.iter_resources(ty, &mut resource_map);
        }
        resource_map
    }

    fn iter_resources(&self, ty: &Type, map: &mut ResourceMap) {
        let Type::Id(id) = ty else { return };
        match &self.resolve.types[*id].kind {
            TypeDefKind::Flags(_) | TypeDefKind::Enum(_) => {}
            TypeDefKind::Record(ty) => {
                for field in ty.fields.iter() {
                    self.iter_resources(&field.ty, map);
                }
            }
            TypeDefKind::Handle(Handle::Own(t) | Handle::Borrow(t)) => {
                let resource = js_component_bindgen::dealias(self.resolve, *t);

                let abi = self.resource_directions[&resource];

                let ty = &self.resolve.types[resource];

                let prefix = match &ty.owner {
                    TypeOwner::World(_) => todo!("handle resources with world owners"),
                    TypeOwner::Interface(id) => {
                        interface_name(self.resolve, *id).map(|s| format!("{s}$"))
                    }
                    TypeOwner::None => unreachable!(),
                };

                map.insert(
                    resource,
                    ResourceTable {
                        imported: abi == AbiVariant::GuestImport,
                        data: ResourceData::Guest {
                            resource_name: ty.name.clone().unwrap(),
                            prefix,
                        },
                    },
                );
            }

            TypeDefKind::Tuple(t) => {
                for ty in t.types.iter() {
                    self.iter_resources(ty, map);
                }
            }
            TypeDefKind::Variant(t) => {
                for case in t.cases.iter() {
                    if let Some(ty) = &case.ty {
                        self.iter_resources(ty, map);
                    }
                }
            }
            TypeDefKind::Option(ty) => {
                self.iter_resources(ty, map);
            }
            TypeDefKind::Result(ty) => {
                if let Some(ty) = &ty.ok {
                    self.iter_resources(ty, map);
                }
                if let Some(ty) = &ty.err {
                    self.iter_resources(ty, map);
                }
            }
            TypeDefKind::List(ty) => {
                self.iter_resources(ty, map);
            }
            TypeDefKind::Type(ty) => {
                self.iter_resources(ty, map);
            }
            _ => unreachable!(),
        }
    }

    fn bindgen(
        &mut self,
        nparams: usize,
        callee: &str,
        string_encoding: StringEncoding,
        func: &Function,
        abi: AbiVariant,
    ) {
        self.src.push_str("(");
        let mut params = Vec::new();
        for i in 0..nparams {
            if i > 0 {
                self.src.push_str(", ");
            }
            let param = format!("arg{i}");
            self.src.push_str(&param);
            params.push(param);
        }
        uwriteln!(self.src, ") {{");

        let resource_map = self.create_resource_map(func);

        for (id, table) in &resource_map {
            if table.imported {
                self.imported_resources.insert(*id);
            }
        }

        let mut f = FunctionBindgen {
            tracing_prefix: None,
            intrinsics: &mut self.all_intrinsics,
            valid_lifting_optimization: true,
            sizes: &self.sizes,
            err: if func.results.throws(self.resolve).is_some() {
                match abi {
                    AbiVariant::GuestExport => ErrHandling::ThrowResultErr,
                    AbiVariant::GuestImport => ErrHandling::ResultCatchHandler,
                }
            } else {
                ErrHandling::None
            },
            block_storage: Vec::new(),
            blocks: Vec::new(),
            callee,
            memory: Some(&self.memory),
            realloc: Some(&self.realloc),
            tmp: 0,
            params,
            post_return: None,
            encoding: match string_encoding {
                StringEncoding::UTF8 => StringEncoding::UTF8,
                StringEncoding::UTF16 => todo!("UTF16 encoding"),
                StringEncoding::CompactUTF16 => todo!("Compact UTF16 encoding"),
            },
            src: Source::default(),
            resource_map: &resource_map,
            cur_resource_borrows: Vec::new(),
            resolve: self.resolve,
        };
        abi::call(
            self.resolve,
            abi,
            match abi {
                AbiVariant::GuestImport => LiftLower::LiftArgsLowerResults,
                AbiVariant::GuestExport => LiftLower::LowerArgsLiftResults,
            },
            func,
            &mut f,
        );
        self.src.push_str(&f.src);
        self.src.push_str("}");
    }

    fn export_bindgen(
        &mut self,
        name: String,
        iface: bool,
        iface_name: Option<String>,
        callee: &str,
        string_encoding: StringEncoding,
        func: &Function,
    ) {
        let fn_name = func.item_name();
        let fn_camel_name = fn_name.to_lower_camel_case();

        let (resource, callee) = match &func.kind {
            FunctionKind::Freestanding => (Resource::None, callee.to_string()),
            FunctionKind::Method(ty) => (
                Resource::Method(self.resolve.types[*ty].name.clone().unwrap()),
                format!("{callee}.prototype.{fn_camel_name}.call"),
            ),
            FunctionKind::Static(ty) => (
                Resource::Static(self.resolve.types[*ty].name.clone().unwrap()),
                format!("{callee}.{fn_camel_name}"),
            ),
            FunctionKind::Constructor(ty) => (
                Resource::Constructor(self.resolve.types[*ty].name.clone().unwrap()),
                format!("new {callee}"),
            ),
        };

        let binding_name = format!(
            "export_{}",
            binding_name(&resource.func_name(fn_name), &iface_name)
        );

        uwrite!(self.src, "\nexport function {binding_name}");

        // exports are canonicalized as imports because
        // the function bindgen as currently written still makes this assumption
        let sig = self.resolve.wasm_signature(AbiVariant::GuestImport, func);

        self.bindgen(
            sig.params.len(),
            &callee,
            string_encoding,
            func,
            AbiVariant::GuestImport,
        );
        self.src.push_str("\n");

        // populate core function return info for splicer
        self.exports.push((
            name,
            BindingItem {
                iface,
                binding_name,
                iface_name,
                name: fn_name.to_string(),
                resource,
                func: self.core_fn(
                    func,
                    &self.resolve.wasm_signature(AbiVariant::GuestExport, func),
                ),
            },
        ));
    }

    fn core_fn(&self, func: &Function, sig: &WasmSignature) -> CoreFn {
        CoreFn {
            retsize: if sig.retptr {
                let mut retsize: u32 = 0;
                for ret_ty in func.results.iter_types() {
                    retsize += self.sizes.size(ret_ty) as u32;
                }
                retsize
            } else {
                0
            },
            retptr: sig.retptr,
            paramptr: sig.indirect_params,
            params: sig
                .params
                .iter()
                .map(|v| match v {
                    wit_parser::abi::WasmType::I32 => CoreTy::I32,
                    wit_parser::abi::WasmType::I64 => CoreTy::I64,
                    wit_parser::abi::WasmType::F32 => CoreTy::F32,
                    wit_parser::abi::WasmType::F64 => CoreTy::F64,
                })
                .collect(),
            ret: match sig.results.first() {
                None => None,
                Some(wit_parser::abi::WasmType::I32) => Some(CoreTy::I32),
                Some(wit_parser::abi::WasmType::I64) => Some(CoreTy::I64),
                Some(wit_parser::abi::WasmType::F32) => Some(CoreTy::F32),
                Some(wit_parser::abi::WasmType::F64) => Some(CoreTy::F64),
            },
        }
    }
}

type LocalName = String;

#[derive(Debug)]
enum Binding {
    Interface(BTreeMap<String, Binding>),
    Resource(LocalName),
    Local(LocalName),
}

#[derive(Default)]
struct EsmBindgen {
    exports: BTreeMap<String, Binding>,
    export_aliases: BTreeMap<String, String>,
}

impl EsmBindgen {
    /// add an exported function binding, optionally on an interface id or kebab name
    pub fn add_export_func(
        &mut self,
        iface_id_or_kebab: Option<&str>,
        local_name: String,
        func_name: String,
    ) {
        let mut iface = &mut self.exports;
        if let Some(iface_id_or_kebab) = iface_id_or_kebab {
            // convert kebab names to camel case, leave ids as-is
            let iface_id_or_kebab = if iface_id_or_kebab.contains(':') {
                iface_id_or_kebab.to_string()
            } else {
                iface_id_or_kebab.to_lower_camel_case()
            };
            if !iface.contains_key(&iface_id_or_kebab) {
                iface.insert(
                    iface_id_or_kebab.to_string(),
                    Binding::Interface(BTreeMap::new()),
                );
            }
            iface = match iface.get_mut(&iface_id_or_kebab).unwrap() {
                Binding::Interface(iface) => iface,
                Binding::Resource(_) | Binding::Local(_) => panic!(
                    "Exported interface {} cannot be both a function and an interface or resource",
                    iface_id_or_kebab
                ),
            };
        }
        iface.insert(func_name, Binding::Local(local_name));
    }

    pub fn ensure_exported_resource(
        &mut self,
        iface_id_or_kebab: Option<&str>,
        local_name: String,
        resource_name: String,
    ) {
        let mut iface = &mut self.exports;
        if let Some(iface_id_or_kebab) = iface_id_or_kebab {
            // convert kebab names to camel case, leave ids as-is
            let iface_id_or_kebab = if iface_id_or_kebab.contains(':') {
                iface_id_or_kebab.to_string()
            } else {
                iface_id_or_kebab.to_lower_camel_case()
            };
            if !iface.contains_key(&iface_id_or_kebab) {
                iface.insert(
                    iface_id_or_kebab.to_string(),
                    Binding::Interface(BTreeMap::new()),
                );
            }
            iface = match iface.get_mut(&iface_id_or_kebab).unwrap() {
                Binding::Interface(iface) => iface,
                Binding::Resource(_) | Binding::Local(_) => panic!(
                    "Exported interface {} cannot be both a function and an interface or resource",
                    iface_id_or_kebab
                ),
            };
        }
        iface.insert(resource_name, Binding::Resource(local_name));
    }

    /// once all exports have been created, aliases can be populated for interface
    /// names that do not collide with kebab names or other interface names
    pub fn populate_export_aliases(&mut self) {
        for expt_name in self.exports.keys() {
            let expt_name_sans_version = if let Some(version_idx) = expt_name.find('@') {
                &expt_name[0..version_idx]
            } else {
                &expt_name
            };
            if let Some(alias) = interface_name_from_string(expt_name_sans_version) {
                if !self.exports.contains_key(&alias)
                    && !self.export_aliases.values().any(|_alias| &alias == _alias)
                {
                    self.export_aliases.insert(expt_name.to_string(), alias);
                }
            }
        }
    }

    pub fn render_export_imports(
        &mut self,
        output: &mut Source,
        imports_object: &str,
        _local_names: &mut LocalNames,
        source_name: &str,
    ) {
        // TODO: bring back these validations of imports
        // including using the flattened bindings
        if self.exports.len() > 0 {
            // error handling
            uwriteln!(output, "
                class BindingsError extends Error {{
                    constructor (path, type, helpContext, help) {{
                        super(`\"{source_name}\" source does not export a \"${{path}}\" ${{type}} as expected by the world.${{
                            help ? `\\n\\n  Try defining it${{helpContext}}:\\n\\n${{'    ' + help.split('\\n').map(ln => `  ${{ln}}`).join('\\n')}}\n` : ''
                        }}`);
                    }}
                }}
                function getInterfaceExport (mod, exportNameOrAlias, exportId) {{
                    if (typeof mod[exportId] === 'object')
                        return mod[exportId];
                    if (exportNameOrAlias && typeof mod[exportNameOrAlias] === 'object')
                        return mod[exportNameOrAlias];
                    if (!exportNameOrAlias)
                        throw new BindingsError(exportId, 'interface', ' by its qualified interface name', `const obj = {{}};\n\nexport {{ obj as '${{exportId}}' }}\n`);
                    else
                        throw new BindingsError(exportNameOrAlias, 'interface', exportId && exportNameOrAlias ? ' by its alias' : ' by name', `export const ${{exportNameOrAlias}} = {{}};`);
                }}
                function verifyInterfaceFn (fn, exportName, ifaceProp, interfaceExportAlias) {{
                    if (typeof fn !== 'function') {{
                        if (!interfaceExportAlias)
                            throw new BindingsError(exportName, `${{ifaceProp}} function`, ' on the exported interface object', `const obj = {{\n\t${{ifaceProp}} () {{\n\n}}\n}};\n\nexport {{ obj as '${{exportName}}' }}\n`);
                        else
                            throw new BindingsError(exportName, `${{ifaceProp}} function`, ` on the interface alias \"${{interfaceExportAlias}}\"`, `export const ${{interfaceExportAlias}} = {{\n\t${{ifaceProp}} () {{\n\n}}\n}};`);
                    }}
                }}
                function verifyInterfaceResource (fn, exportName, ifaceProp, interfaceExportAlias) {{
                    if (typeof fn !== 'function') {{
                        if (!interfaceExportAlias)
                            throw new BindingsError(exportName, `${{ifaceProp}} resource`, ' on the exported interface object', `const obj = {{\n\t${{ifaceProp}} () {{\n\n}}\n}};\n\nexport {{ obj as '${{exportName}}' }}\n`);
                        else
                            throw new BindingsError(exportName, `${{ifaceProp}} resource`, ` on the interface alias \"${{interfaceExportAlias}}\"`, `export const ${{interfaceExportAlias}} = {{\n\t${{ifaceProp}} () {{\n\n}}\n}};`);
                    }}
                }}
                ");
        }
        for (export_name, binding) in &self.exports {
            match binding {
                Binding::Interface(bindings) => {
                    uwrite!(output, "const ");
                    uwrite!(output, "{{");
                    let mut first = true;
                    for (external_name, import) in bindings {
                        if first {
                            output.push_str(" ");
                            first = false;
                        } else {
                            output.push_str(", ");
                        }
                        let local_name = match import {
                            Binding::Interface(_) => panic!("Nested interfaces unsupported"),
                            Binding::Resource(local_name) | Binding::Local(local_name) => {
                                local_name
                            }
                        };
                        if external_name == local_name {
                            uwrite!(output, "{external_name}");
                        } else {
                            uwrite!(output, "{external_name}: {local_name}");
                        }
                    }
                    if !first {
                        output.push_str(" ");
                    }
                    if let Some(alias) = self.export_aliases.get(export_name) {
                        // aliased namespace id
                        uwriteln!(
                            output,
                            "}} = getInterfaceExport({imports_object}, '{alias}', '{export_name}');",
                        );
                    } else if export_name.contains(':') {
                        // ID case without alias (different error messaging)
                        uwriteln!(
                            output,
                            "}} = getInterfaceExport({imports_object}, null, '{export_name}');",
                        );
                    } else {
                        // kebab name interface
                        uwriteln!(
                            output,
                            "}} = getInterfaceExport({imports_object}, '{export_name}', null);",
                        );
                    }
                    // After defining all the local bindings, verify them throwing errors as necessary
                    for (external_name, import) in bindings {
                        let local_name = match import {
                            Binding::Interface(_) => panic!("Nested interfaces unsupported"),
                            Binding::Resource(local_name) | Binding::Local(local_name) => {
                                local_name
                            }
                        };
                        let is_resource = matches!(import, Binding::Resource(_));
                        let verify_name = if is_resource {
                            "verifyInterfaceResource"
                        } else {
                            "verifyInterfaceFn"
                        };
                        if let Some(alias) = self.export_aliases.get(export_name) {
                            uwriteln!(output, "{verify_name}({local_name}, '{export_name}', '{external_name}', '{alias}');");
                        } else {
                            uwriteln!(output, "{verify_name}({local_name}, '{export_name}', '{external_name}', null);");
                        };
                    }
                }
                Binding::Resource(local_name) => {
                    uwriteln!(output, "
                        const {local_name} = {imports_object}.{export_name};
                        if (typeof {local_name} !== 'function')
                            throw new BindingsError('{export_name}', 'function', '', `export function {export_name} () {{}};\n`);
                    ");
                }
                Binding::Local(local_name) => {
                    uwriteln!(output, "
                        const {local_name} = {imports_object}.{export_name};
                        if (typeof {local_name} !== 'function')
                            throw new BindingsError('{export_name}', 'function', '', `export function {export_name} () {{}};\n`);
                    ");
                }
            }
        }
    }
}

fn interface_name(resolve: &Resolve, interface: InterfaceId) -> Option<String> {
    interface_name_from_string(&resolve.id_of(interface)?)
}

fn interface_name_from_string(name: &str) -> Option<String> {
    let path_idx = name.rfind('/')?;
    let name = &name[path_idx + 1..];
    let at_idx = name.rfind('@');
    let alias = name[..at_idx.unwrap_or_else(|| name.len())].to_lower_camel_case();
    let iface_name = Some(if let Some(at_idx) = at_idx {
        format!(
            "{alias}_{}",
            name[at_idx + 1..].replace('.', "_").replace('-', "_")
        )
    } else {
        alias
    });
    iface_name
}

fn binding_name(func_name: &str, iface_name: &Option<String>) -> String {
    match iface_name {
        Some(iface_name) => format!("{iface_name}${func_name}"),
        None => format!("{func_name}"),
    }
}
