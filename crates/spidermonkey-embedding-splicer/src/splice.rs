use anyhow::Result;
use std::borrow::Cow;

use crate::*;
use wasm_encoder::{
    BlockType, CodeSection, ConstExpr, CustomSection, DataSection, ElementSection, Elements,
    EntityType, ExportKind, ExportSection, Function, FunctionSection, GlobalSection, GlobalType,
    HeapType, ImportSection, Instruction, MemArg, MemorySection, MemoryType, Module, RefType,
    StartSection, TableSection, TableType, TagKind, TagSection, TagType, TypeSection, ValType,
};
use wasmparser::{Chunk, OperatorsReader, Parser, Payload, Validator};

const DEBUG: bool = false;

//
// Parses the Spidermonkey binary into section data for reserialization
// into an output binary, and in the process:
//
// 1. The following export names are removed once references are determined:
//    - "coreabi_get_import"
//    - "coreabi_sample_i32"
//    - "coreabi_sample_i64"
//    - "coreabi_sample_f32"
//    - "coreabi_sample_f64"
//
// 2. Exported function bindings and their post-call functions are generated
//    for all provided exported functions ("[name]" and "cabi_post_[name]").
//    These are created simply by calling the "call" and "post_call" generic
//    core wasm functions which take a list of core type variants.
//
// 3. Imported function bindings are generated. This is based on splicing
//    together the core binding steps that are deconstructed from the
//    "coreabi-sample" template, and that function is then removed entirely.
//    Import functions are then placed into the table for indirect call
//    referencing.
//
// 4. Since new imports are added, all function index references
//    throughout the binary are updated by the change offset.
//
// All operations for the above are inlined and commented with a number for
// which of the above they are achieving.
//
// Everything else not apart from these numbered comments is just a
// straightforward parse and re-encode.
//
pub fn splice(
    engine: Vec<u8>,
    imports: Vec<(String, String, CoreFn, Option<i32>)>,
    exports: Vec<(String, CoreFn)>,
) -> Result<Vec<u8>, String> {
    init();

    let mut validator = Validator::new();
    match validator.validate_all(&engine) {
        Ok(_) => {}
        Err(e) => {
            return Err(format!("Input validation error: {:?}", e));
        }
    }

    let mut module = Module::new();

    let mut parser = Parser::new(0);
    let mut offset = 0;

    let mut type_section = TypeSection::new();
    let mut import_section = ImportSection::new();
    let mut func_section = FunctionSection::new();
    let mut table_section = TableSection::new();
    let mut memory_section = MemorySection::new();
    let mut tag_section = TagSection::new();
    let mut global_section = GlobalSection::new();
    let mut export_section = ExportSection::new();
    let mut start_section = None;
    let mut element_section_tablefns: Vec<u32> = Vec::new();
    let mut element_section = ElementSection::new();
    let mut code = CodeSection::new();
    let mut data_sections: Vec<DataSection> = Vec::new();
    let mut custom_sections: Vec<CustomSection> = Vec::new();

    // Tracking of binding functions
    let mut coreabi_sample_fn_idx = None;
    let mut coreabi_sample_fn_bigint64_idx = None;
    let mut coreabi_sample_table_idx = None;
    let mut cabi_realloc_fn_idx = None;
    let mut call_fn_idx = None;
    let mut post_call_fn_idx = None;

    let mut table_el_cnt = 0;
    let mut import_fn_cnt = 0;

    // (2) Do an initial pass to get the exports
    loop {
        let payload = match parser
            .parse(&engine[offset..], true)
            .map_err(|e| format!("Engine parse error: {:?}", e))?
        {
            Chunk::NeedMoreData(_) => unreachable!(),
            Chunk::Parsed { payload, consumed } => {
                offset += consumed;
                payload
            }
        };
        match payload {
            Payload::ExportSection(export_section_reader) => {
                for export in export_section_reader {
                    let wasmparser::Export { name, index, .. } =
                        export.map_err(|e| format!("Splice error:\n{:?}", e))?;
                    match name {
                        // we explicitly rely on the fact that the subsequent 3 instructions are the next ones
                        "coreabi_sample_i32" => coreabi_sample_fn_idx = Some(index),
                        "coreabi_get_import" => {
                            if coreabi_sample_fn_idx.unwrap() + 4 != index {
                                return Err("Unexpected abi for embedding splicing - needs correct coreabi_ exports in order".into());
                            }
                        }
                        "cabi_realloc" => cabi_realloc_fn_idx = Some(index),
                        "call" => call_fn_idx = Some(index),
                        "post_call" => post_call_fn_idx = Some(index),
                        _ => {}
                    }
                }
                break;
            }
            Payload::ImportSection(impt_section_reader) => {
                for import in impt_section_reader {
                    let wasmparser::Import { ty, .. } =
                        import.map_err(|e| format!("Splice error:\n{:?}", e))?;
                    if matches!(ty, wasmparser::TypeRef::Func(_)) {
                        import_fn_cnt += 1;
                    }
                }
            }
            _ => {}
        }
    }

    // (4) function index offset to apply to all function index positions in the new
    // encoded binary (remove coreabi-sample import, add new new imported function bindings)
    let imports_offset = imports.len() as u32;
    let fn_splice_offset: i32 = -4;
    let mut processed_coreabi_sample_code_cnt = 0;

    // (3) coreabi template instructions
    // read out as first Block..End part
    // this is the common native function preload for a function of the form:
    //
    // bool NativeFn(JSContext *cx, unsigned argc, JS::Value *vp) {
    //   JS::CallArgs args = JS::CallArgsFromVp(argc, vp);
    //   ...
    //   return true;
    // }
    //
    let mut instructions_shared_prelude: Vec<Instruction> = Vec::new();

    // These functions retrieve the corresponding type
    // from a JS::HandleValue
    // All except for the BigInt one are trivial and thus
    // do not require regular explicit template extraction
    // unless there are major ABI changes in Spidermonkey
    let instructions_get_i32: Vec<Instruction> = vec![
        Instruction::I64Load(MemArg {
            align: 3,
            offset: 0,
            memory_index: 0,
        }),
        Instruction::I32WrapI64,
    ];
    // BitInt i64 extraction instructions will be populated from template
    let mut instructions_get_i64: Vec<Instruction> = vec![];
    let instructions_get_f32: Vec<Instruction> = vec![
        Instruction::F64Load(MemArg {
            align: 3,
            offset: 0,
            memory_index: 0,
        }),
        Instruction::F32DemoteF64,
    ];
    let instructions_get_f64: Vec<Instruction> = vec![Instruction::F64Load(MemArg {
        align: 3,
        offset: 0,
        memory_index: 0,
    })];
    let instructions_ret_i32: Vec<Instruction> = vec![
        Instruction::I64ExtendI32U,
        Instruction::I64Const(-545460846592),
        Instruction::I64Or,
        Instruction::I64Store(MemArg {
            align: 3,
            offset: 0,
            memory_index: 0,
        }),
    ];
    let instructions_ret_i64: Vec<Instruction> = vec![
        Instruction::I64ExtendI32U,
        Instruction::I64Const(-511101108224),
        Instruction::I64Or,
        Instruction::I64Store(MemArg {
            align: 3,
            offset: 0,
            memory_index: 0,
        }),
    ];
    let instructions_ret_f32: Vec<Instruction> = vec![
        Instruction::F64PromoteF32,
        Instruction::F64Store(MemArg {
            align: 3,
            offset: 0,
            memory_index: 0,
        }),
    ];
    let instructions_ret_f64: Vec<Instruction> = vec![Instruction::F64Store(MemArg {
        align: 3,
        offset: 0,
        memory_index: 0,
    })];

    parser = Parser::new(0);
    offset = 0;
    loop {
        let payload = match parser
            .parse(&engine[offset..], true)
            .map_err(|e| format!("Splice error:\n{:?}", e))?
        {
            Chunk::NeedMoreData(_) => unreachable!(),
            Chunk::Parsed { payload, consumed } => {
                offset += consumed;
                payload
            }
        };

        match payload {
            Payload::Version { .. } => {}
            Payload::TypeSection(type_section_reader) => {
                if DEBUG {
                    console::log(&format!("Type ({:?})", type_section_reader.range()));
                }
                for core_type in type_section_reader {
                    match core_type.map_err(|e| format!("Splice error:\n{:?}", e))? {
                        wasmparser::Type::Func(f) => {
                            type_section.function(
                                f.params().iter().map(val_map),
                                f.results().iter().map(val_map),
                            );
                        }
                    }
                }
            }
            Payload::ImportSection(impt_section_reader) => {
                if DEBUG {
                    console::log(&format!("Import ({:?})", impt_section_reader.range()));
                }
                for import in impt_section_reader {
                    let wasmparser::Import { module, name, ty } =
                        import.map_err(|e| format!("Splice error:\n{:?}", e))?;
                    import_section.import(module, name, ty_map(&ty));
                }
            }
            Payload::FunctionSection(fn_section_reader) => {
                if DEBUG {
                    console::log(&format!("Function ({:?})", fn_section_reader.range()));
                }
                let mut skipped_coreabi_sample_fn_cnt = 0;
                for func in fn_section_reader {
                    // (3) remove coreabi-sample template function
                    if skipped_coreabi_sample_fn_cnt < 4
                        && (func_section.len() + import_fn_cnt
                            == coreabi_sample_fn_idx.unwrap() as u32)
                    {
                        skipped_coreabi_sample_fn_cnt += 1;
                        continue;
                    }
                    func_section.function(func.map_err(|e| format!("Splice error:\n{:?}", e))?);
                }
            }
            Payload::TableSection(table_section_reader) => {
                if DEBUG {
                    console::log(&format!("Table ({:?})", table_section_reader.range()));
                }
                for table in table_section_reader {
                    let wasmparser::Table { ty, init: _ } =
                        table.map_err(|e| format!("Splice error:\n{:?}", e))?;
                    let wasmparser::TableType {
                        ref element_type,
                        initial,
                        maximum,
                    } = ty;
                    table_section.table(TableType {
                        element_type: RefType {
                            nullable: element_type.is_nullable(),
                            heap_type: heap_ty_map(&element_type.heap_type()),
                        },
                        // (3) add space in the table for imports
                        minimum: initial + imports.len() as u32,
                        maximum: Some(maximum.unwrap() + imports.len() as u32),
                    });
                }
            }
            Payload::MemorySection(memory_section_reader) => {
                if DEBUG {
                    console::log(&format!("Memory ({:?})", memory_section_reader.range()));
                }
                for memory in memory_section_reader {
                    let wasmparser::MemoryType {
                        memory64,
                        shared,
                        initial,
                        maximum,
                    } = memory.map_err(|e| format!("Splice error:\n{:?}", e))?;
                    memory_section.memory(MemoryType {
                        minimum: initial,
                        maximum,
                        memory64,
                        shared,
                    });
                }
            }
            Payload::TagSection(tag_section_reader) => {
                if DEBUG {
                    console::log(&format!("Tag ({:?})", tag_section_reader.range()));
                }
                for tag in tag_section_reader {
                    let wasmparser::TagType {
                        kind,
                        func_type_idx,
                    } = tag.map_err(|e| format!("Splice error:\n{:?}", e))?;
                    tag_section.tag(TagType {
                        kind: match kind {
                            wasmparser::TagKind::Exception => TagKind::Exception,
                        },
                        func_type_idx,
                    });
                }
            }
            Payload::GlobalSection(global_section_reader) => {
                if DEBUG {
                    console::log(&format!("Global ({:?})", global_section_reader.range()));
                }
                let range = global_section_reader.range();
                global_section.raw(&engine[range.start + 1..range.end]);
            }
            Payload::ExportSection(export_section_reader) => {
                if DEBUG {
                    console::log(&format!("Export ({:?})", export_section_reader.range()));
                }
                for export in export_section_reader.into_iter() {
                    let wasmparser::Export { name, kind, index } =
                        export.map_err(|e| format!("Splice error:\n{:?}", e))?;

                    // (1) Strip unneeded exports
                    match name {
                        "coreabi_sample_i32" | "coreabi_sample_i64" | "coreabi_sample_f32"
                        | "coreabi_sample_f64" | "coreabi_get_import" => continue,
                        _ => {}
                    }

                    export_section.export(
                        name,
                        match kind {
                            wasmparser::ExternalKind::Func => ExportKind::Func,
                            wasmparser::ExternalKind::Table => ExportKind::Table,
                            wasmparser::ExternalKind::Memory => ExportKind::Memory,
                            wasmparser::ExternalKind::Global => ExportKind::Global,
                            wasmparser::ExternalKind::Tag => ExportKind::Tag,
                        },
                        match kind {
                            wasmparser::ExternalKind::Func => {
                                // (4) function index offsetting
                                remap_fn_idx(
                                    index,
                                    import_fn_cnt,
                                    imports_offset,
                                    coreabi_sample_fn_idx.unwrap(),
                                    fn_splice_offset,
                                )
                                .unwrap()
                            }
                            _ => index,
                        },
                    );
                }
            }
            Payload::StartSection { func, .. } => {
                if DEBUG {
                    console::log(&format!("Start"));
                }
                start_section = Some(StartSection {
                    // (4) Function index offsetting
                    function_index: remap_fn_idx(
                        func,
                        import_fn_cnt,
                        imports_offset,
                        coreabi_sample_fn_idx.unwrap(),
                        fn_splice_offset,
                    )
                    .unwrap(),
                });
            }
            Payload::ElementSection(el_section_reader) => {
                if DEBUG {
                    console::log(&format!("Element ({:?})", el_section_reader.range()));
                }

                if element_section_tablefns.len() > 0 {
                    return Err("Multiple elements sections not yet supported".into());
                }

                for element in el_section_reader {
                    let wasmparser::Element { kind, items, .. } =
                        element.map_err(|e| format!("Splice error:\n{:?}", e))?;
                    match items {
                        wasmparser::ElementItems::Functions(fns) => {
                            for func in fns {
                                let fidx = func.map_err(|e| format!("Splice error:\n{:?}", e))?;

                                // (4) Function index offsetting
                                let idx = match remap_fn_idx(
                                    fidx,
                                    import_fn_cnt,
                                    imports_offset,
                                    coreabi_sample_fn_idx.unwrap(),
                                    fn_splice_offset,
                                ) {
                                    Some(idx) => idx,
                                    None => {
                                        if coreabi_sample_table_idx.is_some() {
                                            return Err("Unexpected multiple table references to coreabi_sample fn".into());
                                        }
                                        coreabi_sample_table_idx = Some(table_el_cnt);
                                        table_section.len()
                                    }
                                };
                                element_section_tablefns.push(idx);
                                table_el_cnt += 1;
                            }
                        }
                        wasmparser::ElementItems::Expressions(_) => {
                            return Err("Expression elements not yet supported".into());
                        }
                    }
                    if matches!(coreabi_sample_table_idx, None) {
                        return Err("Expected a table reference to coreabi_sample fn".into());
                    }

                    match kind {
                        wasmparser::ElementKind::Active {
                            offset_expr,
                            table_index,
                        } => {
                            if table_index != None {
                                todo!("multiple tables");
                            }

                            let mut multiple = false;
                            for op in offset_expr.get_operators_reader() {
                                match op.map_err(|e| format!("Splice error:\n{:?}", e))? {
                                    wasmparser::Operator::I32Const { value } => {
                                        if value != 1 {
                                            return Err("Unexpected table start offset".into());
                                        }
                                    }
                                    wasmparser::Operator::End => break,
                                    _ => return Err("Unexpected const expr".into()),
                                };

                                if multiple {
                                    return Err(
                                        "Unexpected multiple ops in constant expression".into()
                                    );
                                }
                                multiple = true;
                            }
                        }
                        wasmparser::ElementKind::Passive => {
                            return Err("Passive elements not yet supported)".into())
                        }
                        wasmparser::ElementKind::Declared => {
                            return Err("Declared elements not yet supported)".into())
                        }
                    }
                }

                // element_section.raw(&engine[range.start + 1..range.end]);
            }
            Payload::CodeSectionEntry(parse_func) => {
                if DEBUG {
                    // if parse_func.range().start < 40000 {
                    //     console::log(&format!("Code ({:?})", parse_func.range()));
                    // }
                }
                let mut locals: Vec<(u32, ValType)> = Vec::new();
                for local in parse_func
                    .get_locals_reader()
                    .map_err(|e| format!("Splice error:\n{:?}", e))?
                    .into_iter()
                {
                    let (cnt, val_type) = local.map_err(|e| format!("Splice error:\n{:?}", e))?;
                    locals.push((cnt, val_map(&val_type)));
                }

                // (3) deconstruct the sample import against the import function template
                if processed_coreabi_sample_code_cnt < 5
                    && (code.len() + import_fn_cnt == coreabi_sample_fn_idx.unwrap() as u32)
                {
                    // for op in parse_func
                    //     .get_operators_reader()
                    //     .map_err(|e| format!("Splice error:\n{:?}", e))?
                    // {
                    //     console::log(&format!("OP: {:?}", op.unwrap()));
                    // }
                    // first four functions are the 4 sample functions
                    // these are processed to extract the template and removed
                    if processed_coreabi_sample_code_cnt < 4 {
                        if locals.len() != 1 {
                            return Err(format!(
                                "Unexpected abi template local length {} for function {}",
                                locals.len(),
                                processed_coreabi_sample_code_cnt
                            ));
                        }

                        let mut op_reader = parse_func
                            .get_operators_reader()
                            .map_err(|e| format!("Splice error:\n{:?}", e))?;

                        let mut idx = 0;
                        while !op_reader.eof() {
                            let op = op_reader
                                .read()
                                .map_err(|e| format!("Splice error:\n{:?}", e))?;
                            let instruction = op_map(&op);
                            if processed_coreabi_sample_code_cnt == 0 {
                                instructions_shared_prelude.push(instruction);
                            }
                            if matches!(op, wasmparser::Operator::End) {
                                break;
                            }
                            idx += 1;
                        }

                        if idx + 1 != instructions_shared_prelude.len() {
                            return Err("Unexpected abi template prelude length".into());
                        }

                        // BigInt instructions are a little more involved as we need to extract
                        // the separate ToBigInt call
                        if processed_coreabi_sample_code_cnt == 1 {
                            // for op in parse_func
                            //     .get_operators_reader()
                            //     .map_err(|e| format!("Splice error:\n{:?}", e))?
                            // {
                            //     console::log(&format!(":OP: {:?}", op.unwrap()));
                            // }
                            let op = op_reader
                                .read()
                                .map_err(|e| format!("Splice error:\n{:?}", e))?;
                            if !matches!(op, wasmparser::Operator::LocalGet { .. }) {
                                return Err("Unexpected abi template instruction".into());
                            }

                            // skip ahead until the end of the main argument call
                            // to check the return block
                            while !op_reader.eof() {
                                let op = op_reader
                                    .read()
                                    .map_err(|e| format!("Splice error:\n{:?}", e))?;
                                if let wasmparser::Operator::Call { function_index } = op {
                                    // first call is the ToBigInt
                                    instructions_get_i64.push(Instruction::Call(
                                        remap_fn_idx(
                                            function_index,
                                            import_fn_cnt,
                                            imports_offset,
                                            coreabi_sample_fn_idx.unwrap(),
                                            fn_splice_offset,
                                        )
                                        .unwrap(),
                                    ));
                                    break;
                                }
                            }

                            while !op_reader.eof() {
                                let op = op_reader
                                    .read()
                                    .map_err(|e| format!("Splice error:\n{:?}", e))?;
                                if let wasmparser::Operator::Call { function_index } = op {
                                    coreabi_sample_fn_bigint64_idx = Some(function_index);
                                    break;
                                }
                            }
                        }

                        // 5th function is the main coreabi_import function
                        // which then branches into a specific import functions
                        // this function remains, with its internal branching populated here
                    } else {
                        if locals.len() != 0 {
                            return Err("Unexpected abi template locals".into());
                        }

                        let mut op_reader = parse_func
                            .get_operators_reader()
                            .map_err(|e| format!("Splice error:\n{:?}", e))?;

                        // Template Extraction
                        let mut load_memarg: Option<MemArg> = None;
                        let mut new_fn_call_idx: Option<u32> = None;
                        let mut fallback_call_idx: Option<u32> = None;

                        // for op in parse_func
                        //     .get_operators_reader()
                        //     .map_err(|e| format!("Splice error:\n{:?}", e))?
                        // {
                        //     console::log(&format!("OP: {:?}", op.unwrap()));
                        // }

                        // abort is the first call
                        while !op_reader.eof() {
                            let op = read_op(&mut op_reader)?;
                            if let Instruction::Call(fidx) = op {
                                fallback_call_idx = Some(
                                    remap_fn_idx(
                                        fidx,
                                        import_fn_cnt,
                                        imports_offset,
                                        coreabi_sample_fn_idx.unwrap(),
                                        fn_splice_offset,
                                    )
                                    .unwrap(),
                                );
                                break;
                            }
                        }
                        if fallback_call_idx.is_none() {
                            return Err("Unexpected op in import abi sample".into());
                        }

                        // then we pick up the load instruction
                        // as the context load for the JS new function call
                        let mut last_op: Option<Instruction> = None;
                        while !op_reader.eof() {
                            let op = read_op(&mut op_reader)?;
                            if let Instruction::I32Load(memarg) = op {
                                if memarg.offset == 0 {
                                    match last_op {
                                        Some(Instruction::I32Const(offset)) => {
                                            load_memarg = Some(MemArg {
                                                memory_index: 0,
                                                align: 2,
                                                offset: offset as u64,
                                            })
                                        }
                                        _ => {
                                            return Err("Unexpected op in import abi sample".into());
                                        }
                                    }
                                } else {
                                    load_memarg = Some(memarg);
                                }
                                break;
                            }
                            last_op = Some(op);
                        }
                        if load_memarg.is_none() {
                            return Err("Unexpected op in import abi sample".into());
                        }

                        // table index of cabi_i32 (start of template functions)
                        // is the next constant
                        // // next call is the JS_NewFunction call
                        while !op_reader.eof() {
                            let op = read_op(&mut op_reader)?;
                            if let Instruction::Call(fidx) = op {
                                new_fn_call_idx = Some(
                                    remap_fn_idx(
                                        fidx,
                                        import_fn_cnt,
                                        imports_offset,
                                        coreabi_sample_fn_idx.unwrap(),
                                        fn_splice_offset,
                                    )
                                    .unwrap(),
                                );
                                break;
                            }
                        }
                        if new_fn_call_idx.is_none() {
                            return Err("Unexpected op in import abi sample".into());
                        }

                        // Generation
                        // - Block for each import function + block for fallback
                        // - Monotonic BrTable between blocks
                        // - each block of the basic call form for new function
                        let mut func = Function::new(locals);

                        if DEBUG {
                            console::log("> COREABI IMPORT GATE FN");
                        }

                        if imports.len() > 0 {
                            for _ in 0..imports.len() {
                                add_instruction(&mut func, &Instruction::Block(BlockType::Empty));
                            }

                            add_instruction(&mut func, &Instruction::Block(BlockType::Empty));
                            add_instruction(&mut func, &Instruction::LocalGet(0));
                            let targets: Vec<u32> =
                                (0 as u32..imports.len() as u32).rev().collect();
                            add_instruction(
                                &mut func,
                                &Instruction::BrTable(Cow::from(targets), imports.len() as u32),
                            );
                            add_instruction(&mut func, &Instruction::End);

                            // "NewFunction" call block for each import
                            for (idx, (_, _, impt_sig, _)) in imports.iter().enumerate().rev() {
                                add_instruction(&mut func, &Instruction::I32Const(0));
                                add_instruction(
                                    &mut func,
                                    &Instruction::I32Load(load_memarg.unwrap()),
                                );
                                // function pointer
                                add_instruction(
                                    &mut func,
                                    &Instruction::I32Const(table_el_cnt + idx as i32 + 1),
                                );
                                add_instruction(
                                    &mut func,
                                    &Instruction::I32Const(impt_sig.params.len() as i32),
                                );
                                add_instruction(&mut func, &Instruction::I32Const(0));
                                add_instruction(&mut func, &Instruction::LocalGet(1));
                                add_instruction(
                                    &mut func,
                                    &Instruction::Call(new_fn_call_idx.unwrap()),
                                );

                                add_instruction(&mut func, &Instruction::Return);

                                add_instruction(&mut func, &Instruction::End);
                            }
                        }

                        add_instruction(&mut func, &Instruction::Call(fallback_call_idx.unwrap()));
                        add_instruction(&mut func, &Instruction::Unreachable);
                        add_instruction(&mut func, &Instruction::End);

                        if DEBUG {
                            console::log("< COREABI IMPORT GATE FN");
                        }

                        code.function(&func);
                    }

                    processed_coreabi_sample_code_cnt += 1;

                // all other functions are passed through unchanged, with call
                // offset updates based on the splicing offset changes
                } else {
                    let mut func = Function::new(locals);
                    for op in parse_func
                        .get_operators_reader()
                        .map_err(|e| format!("Splice error:\n{:?}", e))?
                    {
                        let instruction =
                            op_map(&op.map_err(|e| format!("Splice error:\n{:?}", e))?);
                        func.instruction(&match instruction {
                            // Call -> fn offset
                            Instruction::Call(fidx) => Instruction::Call(
                                remap_fn_idx(
                                    fidx,
                                    import_fn_cnt,
                                    imports_offset,
                                    coreabi_sample_fn_idx.unwrap(),
                                    fn_splice_offset,
                                )
                                .unwrap(),
                            ),
                            _ => instruction,
                        });
                    }
                    code.function(&func);
                }

                // for op in parse_func
                // .get_operators_reader()
                // .map_err(|e| format!("Splice error:\n{:?}", e))?
                // {
                //     console::log(&format!("OP: {:?}", op.unwrap()));
                // }
            }
            Payload::DataSection(data_section_reader) => {
                if DEBUG {
                    console::log(&format!("Data ({:?})", data_section_reader.range()));
                }
                let mut section = DataSection::new();
                for item in data_section_reader.into_iter_with_offsets() {
                    let (_, data) = item.map_err(|e| format!("Splice error:\n{:?}", e))?;
                    section.raw(&engine[data.range.start..data.range.end]);
                }
                // section.raw(&engine[range.start + 1..range.end]);
                // for data in data_section_reader {
                //     let wasmparser::Data { kind, data, .. } =
                //         data.map_err(|e| format!("Splice error:\n{:?}", e))?;
                //     match kind {
                //         wasmparser::DataKind::Active {
                //             memory_index,
                //             offset_expr,
                //         } => {
                //             let const_range = offset_expr.get_binary_reader().range();
                //             section.active(
                //                 memory_index,
                //                 &ConstExpr::raw(
                //                     engine[const_range.start..const_range.end - 1]
                //                         .iter()
                //                         .copied(),
                //                 ),
                //                 data.iter().copied(),
                //             );
                //         }
                //         wasmparser::DataKind::Passive => {
                //             section.passive(data.iter().copied());
                //         }
                //     };
                // }
                data_sections.push(section);
            }
            Payload::CustomSection(custom_section_reader) => {
                if DEBUG {
                    console::log(&format!("Custom ({:?})", custom_section_reader.range()));
                }

                // (https://github.com/gimli-rs/gimli)
                // OR a debug build hack via repeated dummy imports...
                // for now, no debug builds

                let name = custom_section_reader.name();
                let data = custom_section_reader.data();
                let section = CustomSection {
                    name: name.into(),
                    data: data.into(),
                };
                custom_sections.push(section);
            }
            Payload::CodeSectionStart { .. } | Payload::DataCountSection { .. } => {}
            Payload::UnknownSection { .. } => return Err("Unknown section".into()),
            Payload::ComponentSection { .. }
            | Payload::ComponentInstanceSection(_)
            | Payload::ComponentAliasSection(_)
            | Payload::ComponentTypeSection(_)
            | Payload::ComponentCanonicalSection(_)
            | Payload::ComponentStartSection { .. }
            | Payload::ComponentImportSection(_)
            | Payload::ComponentExportSection(_)
            | Payload::CoreTypeSection(_)
            | Payload::ModuleSection { .. }
            | Payload::InstanceSection(_) => return Err("Unexpected component section".into()),
            Payload::End(_) => break,
        }
    }

    // (2) Export call function synthesis
    let mut post_call_ty_idx: Option<u32> = None;
    for (export_num, (expt_name, expt_sig)) in exports.iter().enumerate() {
        if DEBUG {
            console::log(&format!("> EXPORT {} > {:?}", expt_name, &expt_sig));
        }
        // Export function synthesis
        let call_idx = code.len() + import_fn_cnt + imports.len() as u32;
        {
            // add the function type
            let params: Vec<ValType> = expt_sig
                .params
                .iter()
                .map(|ty| match ty {
                    CoreTy::I32 => ValType::I32,
                    CoreTy::I64 => ValType::I64,
                    CoreTy::F32 => ValType::F32,
                    CoreTy::F64 => ValType::F64,
                })
                .collect();
            type_section.function(
                params,
                expt_sig
                    .ret
                    .iter()
                    .map(|ty| match ty {
                        CoreTy::I32 => ValType::I32,
                        CoreTy::I64 => ValType::I64,
                        CoreTy::F32 => ValType::F32,
                        CoreTy::F64 => ValType::F64,
                    })
                    .collect::<Vec<ValType>>(),
            );
            func_section.function(type_section.len() - 1);

            // create fn with argptr local
            let mut func = Function::new_with_locals_types(vec![ValType::I32, ValType::I32]);

            // Stack "call" arg1 - export number to call
            add_instruction(&mut func, &Instruction::I32Const(export_num as i32));

            // Now we just have to add the argptr
            if expt_sig.params.len() == 0 {
                add_instruction(&mut func, &Instruction::I32Const(0));
            } else if expt_sig.paramptr {
                // param ptr is the first arg with indirect params
                add_instruction(&mut func, &Instruction::LocalGet(0));
            } else {
                // realloc call to allocate params
                add_instruction(&mut func, &Instruction::I32Const(0));
                add_instruction(&mut func, &Instruction::I32Const(0));
                add_instruction(&mut func, &Instruction::I32Const(4));
                // Last realloc arg is byte length to allocate
                let mut byte_size = 0;
                for param in expt_sig.params.iter() {
                    match param {
                        CoreTy::I32 | CoreTy::F32 => {
                            byte_size += 4;
                        }
                        CoreTy::I64 | CoreTy::F64 => {
                            byte_size += 8;
                        }
                    }
                }
                add_instruction(&mut func, &Instruction::I32Const(byte_size));
                // Call realloc, getting back the argptr
                add_instruction(
                    &mut func,
                    &Instruction::Call(
                        remap_fn_idx(
                            cabi_realloc_fn_idx.unwrap(),
                            import_fn_cnt,
                            imports_offset,
                            coreabi_sample_fn_idx.unwrap(),
                            fn_splice_offset,
                        )
                        .unwrap(),
                    ),
                );

                // Tee the argptr into its local var
                add_instruction(
                    &mut func,
                    &Instruction::LocalTee(expt_sig.params.len() as u32),
                );

                let mut offset: u64 = 0;
                for (idx, param) in expt_sig.params.iter().enumerate() {
                    add_instruction(&mut func, &Instruction::LocalGet(idx as u32));
                    match param {
                        CoreTy::I32 => {
                            add_instruction(
                                &mut func,
                                &Instruction::I32Store(MemArg {
                                    align: 2,
                                    offset: offset,
                                    memory_index: 0,
                                }),
                            );
                            offset += 4;
                        }
                        CoreTy::I64 => {
                            add_instruction(
                                &mut func,
                                &Instruction::I64Store(MemArg {
                                    align: 3,
                                    offset: offset,
                                    memory_index: 0,
                                }),
                            );
                            offset += 8;
                        }
                        CoreTy::F32 => {
                            add_instruction(
                                &mut func,
                                &Instruction::F32Store(MemArg {
                                    align: 2,
                                    offset: offset,
                                    memory_index: 0,
                                }),
                            );
                            offset += 4;
                        }
                        CoreTy::F64 => {
                            add_instruction(
                                &mut func,
                                &Instruction::F64Store(MemArg {
                                    align: 3,
                                    offset: offset,
                                    memory_index: 0,
                                }),
                            );
                            offset += 8;
                        }
                    }
                    add_instruction(
                        &mut func,
                        &Instruction::LocalGet(expt_sig.params.len() as u32),
                    );
                }

                // argptr stays on stack
            }

            // Call "call" (returns retptr)
            add_instruction(
                &mut func,
                &Instruction::Call(
                    remap_fn_idx(
                        call_fn_idx.unwrap(),
                        import_fn_cnt,
                        imports_offset,
                        coreabi_sample_fn_idx.unwrap(),
                        fn_splice_offset,
                    )
                    .unwrap(),
                ),
            );

            if expt_sig.ret.is_none() {
                add_instruction(&mut func, &Instruction::Drop);
            } else if !expt_sig.retptr {
                // Tee retptr into its local var
                add_instruction(
                    &mut func,
                    &Instruction::LocalTee(expt_sig.params.len() as u32 + 1),
                );

                // if it's a direct return, we must read the return
                // value type from the retptr
                match expt_sig.ret.unwrap() {
                    CoreTy::I32 => {
                        add_instruction(
                            &mut func,
                            &Instruction::I32Load(MemArg {
                                align: 2,
                                offset: 0,
                                memory_index: 0,
                            }),
                        );
                    }
                    CoreTy::I64 => {
                        add_instruction(
                            &mut func,
                            &Instruction::I64Load(MemArg {
                                align: 3,
                                offset: 0,
                                memory_index: 0,
                            }),
                        );
                    }
                    CoreTy::F32 => {
                        add_instruction(
                            &mut func,
                            &Instruction::F32Load(MemArg {
                                align: 2,
                                offset: 0,
                                memory_index: 0,
                            }),
                        );
                    }
                    CoreTy::F64 => {
                        add_instruction(
                            &mut func,
                            &Instruction::F64Load(MemArg {
                                align: 3,
                                offset: 0,
                                memory_index: 0,
                            }),
                        );
                    }
                }
            }

            add_instruction(&mut func, &Instruction::End);

            if DEBUG {
                console::log(&format!("< EXPORT {}", expt_name));
            }

            code.function(&func);
        }

        // Post export function synthesis
        let post_call_idx = code.len() + import_fn_cnt + imports.len() as u32;
        {
            if DEBUG {
                console::log(&format!("< EXPORT POST CALL {}", expt_name));
            }

            // add the function type
            func_section.function(match post_call_ty_idx {
                Some(ty_idx) => ty_idx,
                None => {
                    type_section.function(vec![ValType::I32], vec![]);
                    post_call_ty_idx = Some(type_section.len() - 1);
                    type_section.len() - 1
                }
            });

            let mut func = Function::new(vec![]);
            // calls post_call with just the function number argument
            // internally post_call is already tracking the frees needed
            // and that is currently done based on timing assumptions of calls
            add_instruction(&mut func, &Instruction::I32Const(export_num as i32));
            add_instruction(
                &mut func,
                &Instruction::Call(
                    remap_fn_idx(
                        post_call_fn_idx.unwrap(),
                        import_fn_cnt,
                        imports_offset,
                        coreabi_sample_fn_idx.unwrap(),
                        fn_splice_offset,
                    )
                    .unwrap(),
                ),
            );

            add_instruction(&mut func, &Instruction::End);

            if DEBUG {
                console::log(&format!("> EXPORT POST CALL {}", expt_name));
            }

            code.function(&func);
        }

        // finally set up the exports
        export_section.export(&expt_name, ExportKind::Func, call_idx);
        export_section.export(
            &format!("cabi_post_{}", expt_name),
            ExportKind::Func,
            post_call_idx,
        );
    }

    // (3) Import function synthesis
    if imports.len() > 0 {
        // all JS wrapper function bindings have the same type
        // (the Spidermonkey native function binding type)
        // so create that type first
        let coreabi_ty_idx = {
            type_section.function(
                vec![ValType::I32, ValType::I32, ValType::I32],
                vec![ValType::I32],
            );
            type_section.len() - 1
        };

        for (impt_specifier, impt_name, impt_sig, retptr_size) in imports.iter() {
            if DEBUG {
                console::log(&format!(
                    "> IMPORT {} {} > {:?}",
                    impt_specifier, impt_name, &impt_sig
                ));
            }

            // add the imported function type
            let params: Vec<ValType> = impt_sig
                .params
                .iter()
                .map(|ty| match ty {
                    CoreTy::I32 => ValType::I32,
                    CoreTy::I64 => ValType::I64,
                    CoreTy::F32 => ValType::F32,
                    CoreTy::F64 => ValType::F64,
                })
                .collect();
            type_section.function(
                params,
                match impt_sig.ret {
                    Some(ty) => vec![match ty {
                        CoreTy::I32 => ValType::I32,
                        CoreTy::I64 => ValType::I64,
                        CoreTy::F32 => ValType::F32,
                        CoreTy::F64 => ValType::F64,
                    }],
                    None => vec![],
                },
            );
            import_section.import(
                &impt_specifier,
                &impt_name,
                EntityType::Function(type_section.len() - 1),
            );

            // create the native JS binding function
            let mut func = Function::new_with_locals_types(vec![ValType::I64, ValType::I32]);

            for op in instructions_shared_prelude.iter() {
                add_instruction(&mut func, &op);
            }

            // stack the return arg now as it chains with the
            // args we're about to add to the stack
            if impt_sig.ret.is_some() {
                add_instruction(&mut func, &Instruction::LocalGet(2));

                // if an i64 return, then we need to stack the extra BigInt constructor arg for that now
                if matches!(impt_sig.ret.unwrap(), CoreTy::I64) {
                    add_instruction(&mut func, &Instruction::LocalGet(0));
                }
            }

            for (idx, arg) in impt_sig.params.iter().enumerate() {
                // for retptr, we must explicitly created it rather than receiving it
                if impt_sig.retptr && idx == impt_sig.params.len() - 1 {
                    break;
                }
                // JS args
                add_instruction(&mut func, &Instruction::LocalGet(2));
                // JS args offset
                add_instruction(&mut func, &Instruction::I32Const(16 + 8 * idx as i32));
                add_instruction(&mut func, &Instruction::I32Add);
                match arg {
                    CoreTy::I32 => {
                        for instruction in &instructions_get_i32 {
                            add_instruction(&mut func, instruction);
                        }
                    }
                    CoreTy::I64 => {
                        for instruction in &instructions_get_i64 {
                            add_instruction(&mut func, instruction);
                        }
                    }
                    CoreTy::F32 => {
                        for instruction in &instructions_get_f32 {
                            add_instruction(&mut func, instruction);
                        }
                    }
                    CoreTy::F64 => {
                        for instruction in &instructions_get_f64 {
                            add_instruction(&mut func, instruction);
                        }
                    }
                }
            }

            // if a retptr,
            // allocate and put the retptr on the call stack as the last passed argument
            if impt_sig.retptr {
                assert!(!impt_sig.ret.is_some());
                // prepare the context arg for the return set shortly
                add_instruction(&mut func, &Instruction::LocalGet(2));

                // allocate the retptr
                add_instruction(&mut func, &Instruction::I32Const(0));
                add_instruction(&mut func, &Instruction::I32Const(0));
                add_instruction(&mut func, &Instruction::I32Const(4));
                // Last realloc arg is byte length to allocate
                add_instruction(&mut func, &Instruction::I32Const(retptr_size.unwrap()));

                // Call realloc, getting back the retptr
                add_instruction(
                    &mut func,
                    &Instruction::Call(
                        remap_fn_idx(
                            cabi_realloc_fn_idx.unwrap(),
                            import_fn_cnt,
                            imports_offset,
                            coreabi_sample_fn_idx.unwrap(),
                            fn_splice_offset,
                        )
                        .unwrap(),
                    ),
                );

                // tee the retptr into a local
                add_instruction(&mut func, &Instruction::LocalTee(4));

                // also set the retptr as the return value of the JS function
                // (consumes the context arg above)
                for op in instructions_ret_i32.iter() {
                    add_instruction(&mut func, &op);
                }

                // add the retptr back on the stack for the call
                // add_instruction(&mut func, &Instruction::LocalGet(4));
                add_instruction(&mut func, &Instruction::LocalGet(4));
            }

            // main call to the import lowering function
            add_instruction(&mut func, &Instruction::Call(import_section.len() - 1));

            match impt_sig.ret {
                None => {}
                Some(CoreTy::I32) => {
                    for op in instructions_ret_i32.iter() {
                        add_instruction(&mut func, &op);
                    }
                }
                Some(CoreTy::I64) => {
                    // i64 needs a BigInt initialization first
                    add_instruction(
                        &mut func,
                        &Instruction::Call(
                            remap_fn_idx(
                                coreabi_sample_fn_bigint64_idx.unwrap(),
                                import_fn_cnt,
                                imports_offset,
                                coreabi_sample_fn_idx.unwrap(),
                                fn_splice_offset,
                            )
                            .unwrap(),
                        ),
                    );
                    for op in instructions_ret_i64.iter() {
                        add_instruction(&mut func, &op);
                    }
                }
                Some(CoreTy::F32) => {
                    for op in instructions_ret_f32.iter() {
                        add_instruction(&mut func, &op);
                    }
                }
                Some(CoreTy::F64) => {
                    for op in instructions_ret_f64.iter() {
                        add_instruction(&mut func, &op);
                    }
                }
            }

            // return true
            add_instruction(&mut func, &Instruction::I32Const(1));
            add_instruction(&mut func, &Instruction::End);

            func_section.function(coreabi_ty_idx);
            code.function(&func);

            // add import to the table elements
            element_section_tablefns.push(code.len() + import_fn_cnt + imports_offset - 1);

            if DEBUG {
                console::log(&format!("< IMPORT {} {}", impt_specifier, impt_name));
            }
        }
    }

    module.section(&type_section);
    module.section(&import_section);
    module.section(&func_section);
    module.section(&table_section);
    module.section(&memory_section);
    if tag_section.len() > 0 {
        module.section(&tag_section);
    }
    module.section(&global_section);
    module.section(&export_section);
    if start_section.is_some() {
        module.section(&start_section.unwrap());
    }
    element_section.active(
        None,
        &ConstExpr::i32_const(1),
        RefType::FUNCREF,
        Elements::Functions(&element_section_tablefns[0..]),
    );
    module.section(&element_section);
    module.section(&code);
    for ref data in data_sections {
        module.section(data);
    }
    // for ref custom in custom_sections {
    //     module.section(custom);
    // }

    let out = module.finish();

    let mut validator = Validator::new();
    match validator.validate_all(&out) {
        Ok(_) => {}
        Err(e) => {
            console::log(&format!("Output validation error: {:?}", e));
            // return Err(Errno::Unknown);
        }
    }

    Ok(out)
}

fn add_instruction(func: &mut Function, op: &Instruction) {
    if DEBUG {
        console::log(&format!("OP: {:?}", &op));
    }
    func.instruction(op);
}

fn read_op<'a>(op_reader: &mut OperatorsReader) -> Result<Instruction<'a>, String> {
    let op = op_reader
        .read()
        .map_err(|e| format!("Splice error:\n{:?}", e))?;
    Ok(op_map(&op))
}

// (4) function index offsetting
fn remap_fn_idx(
    idx: u32,
    imports_len: u32,
    imports_offset: u32,
    fn_splice_idx: u32,
    fn_splice_offset: i32,
) -> Option<u32> {
    if idx < imports_len {
        Some(idx)
    } else if idx < fn_splice_idx {
        Some(idx + imports_offset)
    } else if idx == fn_splice_idx {
        None
    } else {
        Some(
            (idx + imports_offset)
                .checked_add_signed(fn_splice_offset)
                .unwrap(),
        )
    }
}

fn heap_ty_map(heap_type: &wasmparser::HeapType) -> HeapType {
    match heap_type {
        wasmparser::HeapType::TypedFunc(f) => HeapType::TypedFunc((*f).into()),
        wasmparser::HeapType::Func => HeapType::Func,
        wasmparser::HeapType::Extern => HeapType::Extern,
    }
}

fn ref_map(ty: &wasmparser::RefType) -> RefType {
    let nullable = ty.is_nullable();
    let heap_type = &ty.heap_type();
    RefType {
        nullable,
        heap_type: heap_ty_map(heap_type),
    }
}

fn val_map(ty: &wasmparser::ValType) -> ValType {
    match ty {
        wasmparser::ValType::I32 => ValType::I32,
        wasmparser::ValType::I64 => ValType::I64,
        wasmparser::ValType::F32 => ValType::F32,
        wasmparser::ValType::F64 => ValType::F64,
        wasmparser::ValType::V128 => ValType::V128,
        wasmparser::ValType::Ref(ty) => ValType::Ref(ref_map(ty)),
    }
}

fn ty_map(ty: &wasmparser::TypeRef) -> EntityType {
    match ty {
        wasmparser::TypeRef::Func(fidx) => EntityType::Function(*fidx),
        wasmparser::TypeRef::Table(wasmparser::TableType {
            element_type,
            initial,
            maximum,
        }) => EntityType::Table(TableType {
            element_type: ref_map(element_type),
            minimum: *initial,
            maximum: *maximum,
        }),
        wasmparser::TypeRef::Memory(wasmparser::MemoryType {
            memory64,
            shared,
            initial,
            maximum,
        }) => EntityType::Memory(MemoryType {
            minimum: *initial,
            maximum: maximum.map(|m| m),
            memory64: *memory64,
            shared: *shared,
        }),
        wasmparser::TypeRef::Global(wasmparser::GlobalType {
            content_type,
            mutable,
        }) => EntityType::Global(GlobalType {
            val_type: val_map(content_type),
            mutable: *mutable,
        }),
        wasmparser::TypeRef::Tag(wasmparser::TagType {
            kind,
            func_type_idx,
        }) => EntityType::Tag(TagType {
            kind: match kind {
                wasmparser::TagKind::Exception => TagKind::Exception,
            },
            func_type_idx: *func_type_idx,
        }),
    }
}

fn memarg_map(memarg: &wasmparser::MemArg) -> MemArg {
    let wasmparser::MemArg {
        align,
        offset,
        memory,
        ..
    } = memarg;
    MemArg {
        align: *align as u32,
        offset: *offset,
        memory_index: *memory,
    }
}

fn blockty_map(blockty: &wasmparser::BlockType) -> BlockType {
    match blockty {
        wasmparser::BlockType::Empty => BlockType::Empty,
        wasmparser::BlockType::Type(ty) => BlockType::Result(val_map(ty)),
        wasmparser::BlockType::FuncType(ty) => BlockType::FunctionType(*ty),
    }
}

fn op_map<'a>(op: &wasmparser::Operator) -> Instruction<'a> {
    match op {
        wasmparser::Operator::CallRef { .. } => todo!("call ref"),
        wasmparser::Operator::ReturnCallRef { .. } => todo!("return call ref"),
        wasmparser::Operator::RefAsNonNull { .. } => todo!("ref as non null"),
        wasmparser::Operator::BrOnNonNull { .. } => todo!("br on non null"),
        wasmparser::Operator::BrOnNull { .. } => todo!("br on null"),
        wasmparser::Operator::Unreachable => Instruction::Unreachable,
        wasmparser::Operator::Nop => Instruction::Nop,
        wasmparser::Operator::Block { blockty } => Instruction::Block(blockty_map(blockty)),
        wasmparser::Operator::Loop { blockty } => Instruction::Loop(blockty_map(blockty)),
        wasmparser::Operator::If { blockty } => Instruction::If(blockty_map(blockty)),
        wasmparser::Operator::Else => Instruction::Else,
        wasmparser::Operator::Try { blockty } => Instruction::Try(blockty_map(blockty)),
        wasmparser::Operator::Catch { .. } => todo!("catch"),
        wasmparser::Operator::Throw { .. } => todo!("throw"),
        wasmparser::Operator::Rethrow { .. } => todo!("rethrow"),
        wasmparser::Operator::End => Instruction::End,
        wasmparser::Operator::Br { relative_depth } => Instruction::Br(*relative_depth),
        wasmparser::Operator::BrIf { relative_depth } => Instruction::BrIf(*relative_depth),
        wasmparser::Operator::BrTable { targets } => {
            let mut out_targets = Vec::new();
            for target in targets.targets() {
                out_targets.push(target.unwrap());
            }
            Instruction::BrTable(Cow::from(out_targets), targets.default())
        }
        wasmparser::Operator::Return => Instruction::Return,
        wasmparser::Operator::Call { function_index } => Instruction::Call(*function_index),
        wasmparser::Operator::CallIndirect {
            type_index,
            table_index,
            ..
        } => Instruction::CallIndirect {
            ty: *type_index,
            table: *table_index,
        },
        wasmparser::Operator::ReturnCall { .. } => todo!("returncall"),
        wasmparser::Operator::ReturnCallIndirect { .. } => todo!("returncallindirect"),
        wasmparser::Operator::Delegate { .. } => todo!("delegate"),
        wasmparser::Operator::CatchAll => todo!("catchall"),
        wasmparser::Operator::Drop => Instruction::Drop,
        wasmparser::Operator::Select => Instruction::Select,
        wasmparser::Operator::TypedSelect { .. } => todo!("typedselect"),
        wasmparser::Operator::LocalGet { local_index } => Instruction::LocalGet(*local_index),
        wasmparser::Operator::LocalSet { local_index } => Instruction::LocalSet(*local_index),
        wasmparser::Operator::LocalTee { local_index } => Instruction::LocalTee(*local_index),
        wasmparser::Operator::GlobalGet { global_index } => Instruction::GlobalGet(*global_index),
        wasmparser::Operator::GlobalSet { global_index } => Instruction::GlobalSet(*global_index),
        wasmparser::Operator::I32Load { memarg } => Instruction::I32Load(memarg_map(memarg)),
        wasmparser::Operator::I64Load { memarg } => Instruction::I64Load(memarg_map(memarg)),
        wasmparser::Operator::F32Load { memarg } => Instruction::F32Load(memarg_map(memarg)),
        wasmparser::Operator::F64Load { memarg } => Instruction::F64Load(memarg_map(memarg)),
        wasmparser::Operator::I32Load8S { memarg } => Instruction::I32Load8S(memarg_map(memarg)),
        wasmparser::Operator::I32Load8U { memarg } => Instruction::I32Load8U(memarg_map(memarg)),
        wasmparser::Operator::I32Load16S { memarg } => Instruction::I32Load16S(memarg_map(memarg)),
        wasmparser::Operator::I32Load16U { memarg } => Instruction::I32Load16U(memarg_map(memarg)),
        wasmparser::Operator::I64Load8S { memarg } => Instruction::I64Load8S(memarg_map(memarg)),
        wasmparser::Operator::I64Load8U { memarg } => Instruction::I64Load8U(memarg_map(memarg)),
        wasmparser::Operator::I64Load16S { memarg } => Instruction::I64Load16S(memarg_map(memarg)),
        wasmparser::Operator::I64Load16U { memarg } => Instruction::I64Load16U(memarg_map(memarg)),
        wasmparser::Operator::I64Load32S { memarg } => Instruction::I64Load32S(memarg_map(memarg)),
        wasmparser::Operator::I64Load32U { memarg } => Instruction::I64Load32U(memarg_map(memarg)),
        wasmparser::Operator::I32Store { memarg } => Instruction::I32Store(memarg_map(memarg)),
        wasmparser::Operator::I64Store { memarg } => Instruction::I64Store(memarg_map(memarg)),
        wasmparser::Operator::F32Store { memarg } => Instruction::F32Store(memarg_map(memarg)),
        wasmparser::Operator::F64Store { memarg } => Instruction::F64Store(memarg_map(memarg)),
        wasmparser::Operator::I32Store8 { memarg } => Instruction::I32Store8(memarg_map(memarg)),
        wasmparser::Operator::I32Store16 { memarg } => Instruction::I32Store16(memarg_map(memarg)),
        wasmparser::Operator::I64Store8 { memarg } => Instruction::I64Store8(memarg_map(memarg)),
        wasmparser::Operator::I64Store16 { memarg } => Instruction::I64Store16(memarg_map(memarg)),
        wasmparser::Operator::I64Store32 { memarg } => Instruction::I64Store32(memarg_map(memarg)),
        wasmparser::Operator::MemorySize { mem: _, mem_byte } => {
            Instruction::MemorySize(*mem_byte as u32)
        }
        wasmparser::Operator::MemoryGrow { mem_byte, .. } => {
            Instruction::MemoryGrow(*mem_byte as u32)
        }
        wasmparser::Operator::I32Const { value } => Instruction::I32Const(*value),
        wasmparser::Operator::I64Const { value } => Instruction::I64Const(*value),
        wasmparser::Operator::F32Const { value } => {
            Instruction::F32Const(f32::from_bits(value.bits()))
        }
        wasmparser::Operator::F64Const { value } => {
            Instruction::F64Const(f64::from_bits(value.bits()))
        }
        wasmparser::Operator::RefNull { .. } => todo!("refnull"),
        wasmparser::Operator::RefIsNull => Instruction::RefIsNull,
        wasmparser::Operator::RefFunc { .. } => todo!("reffunc"),
        wasmparser::Operator::I32Eqz => Instruction::I32Eqz,
        wasmparser::Operator::I32Eq => Instruction::I32Eq,
        wasmparser::Operator::I32Ne => Instruction::I32Ne,
        wasmparser::Operator::I32LtS => Instruction::I32LtS,
        wasmparser::Operator::I32LtU => Instruction::I32LtU,
        wasmparser::Operator::I32GtS => Instruction::I32GtS,
        wasmparser::Operator::I32GtU => Instruction::I32GtU,
        wasmparser::Operator::I32LeS => Instruction::I32LeS,
        wasmparser::Operator::I32LeU => Instruction::I32LeU,
        wasmparser::Operator::I32GeS => Instruction::I32GeS,
        wasmparser::Operator::I32GeU => Instruction::I32GeU,
        wasmparser::Operator::I64Eqz => Instruction::I64Eqz,
        wasmparser::Operator::I64Eq => Instruction::I64Eq,
        wasmparser::Operator::I64Ne => Instruction::I64Ne,
        wasmparser::Operator::I64LtS => Instruction::I64LtS,
        wasmparser::Operator::I64LtU => Instruction::I64LtU,
        wasmparser::Operator::I64GtS => Instruction::I64GtS,
        wasmparser::Operator::I64GtU => Instruction::I64GtU,
        wasmparser::Operator::I64LeS => Instruction::I64LeS,
        wasmparser::Operator::I64LeU => Instruction::I64LeU,
        wasmparser::Operator::I64GeS => Instruction::I64GeS,
        wasmparser::Operator::I64GeU => Instruction::I64GeU,
        wasmparser::Operator::F32Eq => Instruction::F32Eq,
        wasmparser::Operator::F32Ne => Instruction::F32Ne,
        wasmparser::Operator::F32Lt => Instruction::F32Lt,
        wasmparser::Operator::F32Gt => Instruction::F32Gt,
        wasmparser::Operator::F32Le => Instruction::F32Le,
        wasmparser::Operator::F32Ge => Instruction::F32Ge,
        wasmparser::Operator::F64Eq => Instruction::F64Eq,
        wasmparser::Operator::F64Ne => Instruction::F64Ne,
        wasmparser::Operator::F64Lt => Instruction::F64Lt,
        wasmparser::Operator::F64Gt => Instruction::F64Gt,
        wasmparser::Operator::F64Le => Instruction::F64Le,
        wasmparser::Operator::F64Ge => Instruction::F64Ge,
        wasmparser::Operator::I32Clz => Instruction::I32Clz,
        wasmparser::Operator::I32Ctz => Instruction::I32Ctz,
        wasmparser::Operator::I32Popcnt => Instruction::I32Popcnt,
        wasmparser::Operator::I32Add => Instruction::I32Add,
        wasmparser::Operator::I32Sub => Instruction::I32Sub,
        wasmparser::Operator::I32Mul => Instruction::I32Mul,
        wasmparser::Operator::I32DivS => Instruction::I32DivS,
        wasmparser::Operator::I32DivU => Instruction::I32DivU,
        wasmparser::Operator::I32RemS => Instruction::I32RemS,
        wasmparser::Operator::I32RemU => Instruction::I32RemU,
        wasmparser::Operator::I32And => Instruction::I32And,
        wasmparser::Operator::I32Or => Instruction::I32Or,
        wasmparser::Operator::I32Xor => Instruction::I32Xor,
        wasmparser::Operator::I32Shl => Instruction::I32Shl,
        wasmparser::Operator::I32ShrS => Instruction::I32ShrS,
        wasmparser::Operator::I32ShrU => Instruction::I32ShrU,
        wasmparser::Operator::I32Rotl => Instruction::I32Rotl,
        wasmparser::Operator::I32Rotr => Instruction::I32Rotr,
        wasmparser::Operator::I64Clz => Instruction::I64Clz,
        wasmparser::Operator::I64Ctz => Instruction::I64Ctz,
        wasmparser::Operator::I64Popcnt => Instruction::I64Popcnt,
        wasmparser::Operator::I64Add => Instruction::I64Add,
        wasmparser::Operator::I64Sub => Instruction::I64Sub,
        wasmparser::Operator::I64Mul => Instruction::I64Mul,
        wasmparser::Operator::I64DivS => Instruction::I64DivS,
        wasmparser::Operator::I64DivU => Instruction::I64DivU,
        wasmparser::Operator::I64RemS => Instruction::I64RemS,
        wasmparser::Operator::I64RemU => Instruction::I64RemU,
        wasmparser::Operator::I64And => Instruction::I64And,
        wasmparser::Operator::I64Or => Instruction::I64Or,
        wasmparser::Operator::I64Xor => Instruction::I64Xor,
        wasmparser::Operator::I64Shl => Instruction::I64Shl,
        wasmparser::Operator::I64ShrS => Instruction::I64ShrS,
        wasmparser::Operator::I64ShrU => Instruction::I64ShrU,
        wasmparser::Operator::I64Rotl => Instruction::I64Rotl,
        wasmparser::Operator::I64Rotr => Instruction::I64Rotr,
        wasmparser::Operator::F32Abs => Instruction::F32Abs,
        wasmparser::Operator::F32Neg => Instruction::F32Neg,
        wasmparser::Operator::F32Ceil => Instruction::F32Ceil,
        wasmparser::Operator::F32Floor => Instruction::F32Floor,
        wasmparser::Operator::F32Trunc => Instruction::F32Trunc,
        wasmparser::Operator::F32Nearest => Instruction::F32Nearest,
        wasmparser::Operator::F32Sqrt => Instruction::F32Sqrt,
        wasmparser::Operator::F32Add => Instruction::F32Add,
        wasmparser::Operator::F32Sub => Instruction::F32Sub,
        wasmparser::Operator::F32Mul => Instruction::F32Mul,
        wasmparser::Operator::F32Div => Instruction::F32Div,
        wasmparser::Operator::F32Min => Instruction::F32Min,
        wasmparser::Operator::F32Max => Instruction::F32Max,
        wasmparser::Operator::F32Copysign => Instruction::F32Copysign,
        wasmparser::Operator::F64Abs => Instruction::F64Abs,
        wasmparser::Operator::F64Neg => Instruction::F64Neg,
        wasmparser::Operator::F64Ceil => Instruction::F64Ceil,
        wasmparser::Operator::F64Floor => Instruction::F64Floor,
        wasmparser::Operator::F64Trunc => Instruction::F64Trunc,
        wasmparser::Operator::F64Nearest => Instruction::F64Nearest,
        wasmparser::Operator::F64Sqrt => Instruction::F64Sqrt,
        wasmparser::Operator::F64Add => Instruction::F64Add,
        wasmparser::Operator::F64Sub => Instruction::F64Sub,
        wasmparser::Operator::F64Mul => Instruction::F64Mul,
        wasmparser::Operator::F64Div => Instruction::F64Div,
        wasmparser::Operator::F64Min => Instruction::F64Min,
        wasmparser::Operator::F64Max => Instruction::F64Max,
        wasmparser::Operator::F64Copysign => Instruction::F64Copysign,
        wasmparser::Operator::I32WrapI64 => Instruction::I32WrapI64,
        wasmparser::Operator::I32TruncF32S => Instruction::I32TruncF32S,
        wasmparser::Operator::I32TruncF32U => Instruction::I32TruncF32U,
        wasmparser::Operator::I32TruncF64S => Instruction::I32TruncF64S,
        wasmparser::Operator::I32TruncF64U => Instruction::I32TruncF64U,
        wasmparser::Operator::I64ExtendI32S => Instruction::I64ExtendI32S,
        wasmparser::Operator::I64ExtendI32U => Instruction::I64ExtendI32U,
        wasmparser::Operator::I64TruncF32S => Instruction::I64TruncF32S,
        wasmparser::Operator::I64TruncF32U => Instruction::I64TruncF32U,
        wasmparser::Operator::I64TruncF64S => Instruction::I64TruncF64S,
        wasmparser::Operator::I64TruncF64U => Instruction::I64TruncF64U,
        wasmparser::Operator::F32ConvertI32S => Instruction::F32ConvertI32S,
        wasmparser::Operator::F32ConvertI32U => Instruction::F32ConvertI32U,
        wasmparser::Operator::F32ConvertI64S => Instruction::F32ConvertI64S,
        wasmparser::Operator::F32ConvertI64U => Instruction::F32ConvertI64U,
        wasmparser::Operator::F32DemoteF64 => Instruction::F32DemoteF64,
        wasmparser::Operator::F64ConvertI32S => Instruction::F64ConvertI32S,
        wasmparser::Operator::F64ConvertI32U => Instruction::F64ConvertI32U,
        wasmparser::Operator::F64ConvertI64S => Instruction::F64ConvertI64S,
        wasmparser::Operator::F64ConvertI64U => Instruction::F64ConvertI64U,
        wasmparser::Operator::F64PromoteF32 => Instruction::F64PromoteF32,
        wasmparser::Operator::I32ReinterpretF32 => Instruction::I32ReinterpretF32,
        wasmparser::Operator::I64ReinterpretF64 => Instruction::I64ReinterpretF64,
        wasmparser::Operator::F32ReinterpretI32 => Instruction::F32ReinterpretI32,
        wasmparser::Operator::F64ReinterpretI64 => Instruction::F64ReinterpretI64,
        wasmparser::Operator::I32Extend8S => Instruction::I32Extend8S,
        wasmparser::Operator::I32Extend16S => Instruction::I32Extend16S,
        wasmparser::Operator::I64Extend8S => Instruction::I64Extend8S,
        wasmparser::Operator::I64Extend16S => Instruction::I64Extend16S,
        wasmparser::Operator::I64Extend32S => Instruction::I64Extend32S,
        wasmparser::Operator::I32TruncSatF32S => Instruction::I32TruncSatF32S,
        wasmparser::Operator::I32TruncSatF32U => Instruction::I32TruncSatF32U,
        wasmparser::Operator::I32TruncSatF64S => Instruction::I32TruncSatF64S,
        wasmparser::Operator::I32TruncSatF64U => Instruction::I32TruncSatF64U,
        wasmparser::Operator::I64TruncSatF32S => Instruction::I64TruncSatF32S,
        wasmparser::Operator::I64TruncSatF32U => Instruction::I64TruncSatF32U,
        wasmparser::Operator::I64TruncSatF64S => Instruction::I64TruncSatF64S,
        wasmparser::Operator::I64TruncSatF64U => Instruction::I64TruncSatF64U,
        wasmparser::Operator::MemoryInit { .. } => todo!("memoryinit"),
        wasmparser::Operator::DataDrop { .. } => todo!("datadrop"),
        wasmparser::Operator::MemoryCopy { dst_mem, src_mem } => Instruction::MemoryCopy {
            src_mem: *src_mem,
            dst_mem: *dst_mem,
        },
        wasmparser::Operator::MemoryFill { mem } => Instruction::MemoryFill(*mem),
        wasmparser::Operator::TableInit { .. } => todo!("tableinit"),
        wasmparser::Operator::ElemDrop { .. } => todo!("elemdrop"),
        wasmparser::Operator::TableCopy { .. } => todo!("tablecopy"),
        wasmparser::Operator::TableFill { .. } => todo!("tablefill"),
        wasmparser::Operator::TableGet { .. } => todo!("tableget"),
        wasmparser::Operator::TableSet { .. } => todo!("tableset"),
        wasmparser::Operator::TableGrow { .. } => todo!("tablegrow"),
        wasmparser::Operator::TableSize { .. } => todo!("tablesize"),
        wasmparser::Operator::MemoryAtomicNotify { memarg } => {
            Instruction::MemoryAtomicNotify(memarg_map(memarg))
        }
        wasmparser::Operator::MemoryAtomicWait32 { memarg } => {
            Instruction::MemoryAtomicWait32(memarg_map(memarg))
        }
        wasmparser::Operator::MemoryAtomicWait64 { memarg } => {
            Instruction::MemoryAtomicWait64(memarg_map(memarg))
        }
        wasmparser::Operator::AtomicFence => Instruction::AtomicFence,
        wasmparser::Operator::I32AtomicLoad { memarg } => {
            Instruction::I32AtomicLoad(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicLoad { memarg } => {
            Instruction::I64AtomicLoad(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicLoad8U { memarg } => {
            Instruction::I32AtomicLoad8U(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicLoad16U { memarg } => {
            Instruction::I32AtomicLoad16U(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicLoad8U { memarg } => {
            Instruction::I64AtomicLoad8U(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicLoad16U { memarg } => {
            Instruction::I64AtomicLoad16U(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicLoad32U { memarg } => {
            Instruction::I64AtomicLoad32U(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicStore { memarg } => {
            Instruction::I32AtomicStore(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicStore { memarg } => {
            Instruction::I64AtomicStore(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicStore8 { memarg } => {
            Instruction::I32AtomicStore8(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicStore16 { memarg } => {
            Instruction::I32AtomicStore16(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicStore8 { memarg } => {
            Instruction::I64AtomicStore8(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicStore16 { memarg } => {
            Instruction::I64AtomicStore16(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicStore32 { memarg } => {
            Instruction::I64AtomicStore32(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmwAdd { memarg } => {
            Instruction::I32AtomicRmwAdd(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmwAdd { memarg } => {
            Instruction::I64AtomicRmwAdd(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw8AddU { memarg } => {
            Instruction::I32AtomicRmw8AddU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw16AddU { memarg } => {
            Instruction::I32AtomicRmw16AddU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw8AddU { memarg } => {
            Instruction::I64AtomicRmw8AddU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw16AddU { memarg } => {
            Instruction::I64AtomicRmw16AddU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw32AddU { memarg } => {
            Instruction::I64AtomicRmw32AddU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmwSub { memarg } => {
            Instruction::I32AtomicRmwSub(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmwSub { memarg } => {
            Instruction::I64AtomicRmwSub(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw8SubU { memarg } => {
            Instruction::I32AtomicRmw8SubU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw16SubU { memarg } => {
            Instruction::I32AtomicRmw16SubU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw8SubU { memarg } => {
            Instruction::I64AtomicRmw8SubU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw16SubU { memarg } => {
            Instruction::I64AtomicRmw16SubU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw32SubU { memarg } => {
            Instruction::I64AtomicRmw32SubU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmwAnd { memarg } => {
            Instruction::I32AtomicRmwAnd(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmwAnd { memarg } => {
            Instruction::I64AtomicRmwAnd(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw8AndU { memarg } => {
            Instruction::I32AtomicRmw8AndU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw16AndU { memarg } => {
            Instruction::I32AtomicRmw16AndU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw8AndU { memarg } => {
            Instruction::I64AtomicRmw8AndU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw16AndU { memarg } => {
            Instruction::I64AtomicRmw16AndU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw32AndU { memarg } => {
            Instruction::I64AtomicRmw32AndU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmwOr { memarg } => {
            Instruction::I32AtomicRmwOr(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmwOr { memarg } => {
            Instruction::I64AtomicRmwOr(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw8OrU { memarg } => {
            Instruction::I32AtomicRmw8OrU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw16OrU { memarg } => {
            Instruction::I32AtomicRmw16OrU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw8OrU { memarg } => {
            Instruction::I64AtomicRmw8OrU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw16OrU { memarg } => {
            Instruction::I64AtomicRmw16OrU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw32OrU { memarg } => {
            Instruction::I64AtomicRmw32OrU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmwXor { memarg } => {
            Instruction::I32AtomicRmwXor(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmwXor { memarg } => {
            Instruction::I64AtomicRmwXor(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw8XorU { memarg } => {
            Instruction::I32AtomicRmw8XorU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw16XorU { memarg } => {
            Instruction::I32AtomicRmw16XorU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw8XorU { memarg } => {
            Instruction::I64AtomicRmw8XorU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw16XorU { memarg } => {
            Instruction::I64AtomicRmw16XorU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw32XorU { memarg } => {
            Instruction::I64AtomicRmw32XorU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmwXchg { memarg } => {
            Instruction::I32AtomicRmwXchg(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmwXchg { memarg } => {
            Instruction::I64AtomicRmwXchg(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw8XchgU { memarg } => {
            Instruction::I32AtomicRmw8XchgU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw16XchgU { memarg } => {
            Instruction::I32AtomicRmw16XchgU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw8XchgU { memarg } => {
            Instruction::I64AtomicRmw8XchgU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw16XchgU { memarg } => {
            Instruction::I64AtomicRmw16XchgU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw32XchgU { memarg } => {
            Instruction::I64AtomicRmw32XchgU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmwCmpxchg { memarg } => {
            Instruction::I32AtomicRmwCmpxchg(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmwCmpxchg { memarg } => {
            Instruction::I64AtomicRmwCmpxchg(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw8CmpxchgU { memarg } => {
            Instruction::I32AtomicRmw8CmpxchgU(memarg_map(memarg))
        }
        wasmparser::Operator::I32AtomicRmw16CmpxchgU { memarg } => {
            Instruction::I32AtomicRmw16CmpxchgU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw8CmpxchgU { memarg } => {
            Instruction::I64AtomicRmw8CmpxchgU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw16CmpxchgU { memarg } => {
            Instruction::I64AtomicRmw16CmpxchgU(memarg_map(memarg))
        }
        wasmparser::Operator::I64AtomicRmw32CmpxchgU { memarg } => {
            Instruction::I64AtomicRmw32CmpxchgU(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load { memarg } => Instruction::V128Load(memarg_map(memarg)),
        wasmparser::Operator::V128Load8x8S { memarg } => {
            Instruction::V128Load8x8S(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load8x8U { memarg } => {
            Instruction::V128Load8x8U(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load16x4S { memarg } => {
            Instruction::V128Load16x4S(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load16x4U { memarg } => {
            Instruction::V128Load16x4U(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load32x2S { memarg } => {
            Instruction::V128Load32x2S(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load32x2U { memarg } => {
            Instruction::V128Load32x2U(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load8Splat { memarg } => {
            Instruction::V128Load8Splat(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load16Splat { memarg } => {
            Instruction::V128Load16Splat(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load32Splat { memarg } => {
            Instruction::V128Load32Splat(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load64Splat { memarg } => {
            Instruction::V128Load64Splat(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load32Zero { memarg } => {
            Instruction::V128Load32Zero(memarg_map(memarg))
        }
        wasmparser::Operator::V128Load64Zero { memarg } => {
            Instruction::V128Load64Zero(memarg_map(memarg))
        }
        wasmparser::Operator::V128Store { memarg } => Instruction::V128Store(memarg_map(memarg)),
        wasmparser::Operator::V128Load8Lane { .. } => todo!("lanes"),
        wasmparser::Operator::V128Load16Lane { .. } => todo!("lanes"),
        wasmparser::Operator::V128Load32Lane { .. } => todo!("lanes"),
        wasmparser::Operator::V128Load64Lane { .. } => todo!("lanes"),
        wasmparser::Operator::V128Store8Lane { .. } => todo!("lanes"),
        wasmparser::Operator::V128Store16Lane { .. } => todo!("lanes"),
        wasmparser::Operator::V128Store32Lane { .. } => todo!("lanes"),
        wasmparser::Operator::V128Store64Lane { .. } => todo!("lanes"),
        wasmparser::Operator::V128Const { .. } => todo!("lanes"),
        wasmparser::Operator::I8x16Shuffle { .. } => todo!("lanes"),
        wasmparser::Operator::I8x16ExtractLaneS { .. } => todo!("lanes"),
        wasmparser::Operator::I8x16ExtractLaneU { .. } => todo!("lanes"),
        wasmparser::Operator::I8x16ReplaceLane { .. } => todo!("lanes"),
        wasmparser::Operator::I16x8ExtractLaneS { .. } => todo!("lanes"),
        wasmparser::Operator::I16x8ExtractLaneU { .. } => todo!("lanes"),
        wasmparser::Operator::I16x8ReplaceLane { .. } => todo!("lanes"),
        wasmparser::Operator::I32x4ExtractLane { .. } => todo!("lanes"),
        wasmparser::Operator::I32x4ReplaceLane { .. } => todo!("lanes"),
        wasmparser::Operator::I64x2ExtractLane { .. } => todo!("lanes"),
        wasmparser::Operator::I64x2ReplaceLane { .. } => todo!("lanes"),
        wasmparser::Operator::F32x4ExtractLane { .. } => todo!("lanes"),
        wasmparser::Operator::F32x4ReplaceLane { .. } => todo!("lanes"),
        wasmparser::Operator::F64x2ExtractLane { .. } => todo!("lanes"),
        wasmparser::Operator::F64x2ReplaceLane { .. } => todo!("lanes"),
        wasmparser::Operator::I8x16Swizzle => Instruction::I8x16Swizzle,
        wasmparser::Operator::I8x16Splat => Instruction::I8x16Splat,
        wasmparser::Operator::I16x8Splat => Instruction::I16x8Splat,
        wasmparser::Operator::I32x4Splat => Instruction::I32x4Splat,
        wasmparser::Operator::I64x2Splat => Instruction::I64x2Splat,
        wasmparser::Operator::F32x4Splat => Instruction::F32x4Splat,
        wasmparser::Operator::F64x2Splat => Instruction::F64x2Splat,
        wasmparser::Operator::I8x16Eq => Instruction::I8x16Eq,
        wasmparser::Operator::I8x16Ne => Instruction::I8x16Ne,
        wasmparser::Operator::I8x16LtS => Instruction::I8x16LtS,
        wasmparser::Operator::I8x16LtU => Instruction::I8x16LtU,
        wasmparser::Operator::I8x16GtS => Instruction::I8x16GtS,
        wasmparser::Operator::I8x16GtU => Instruction::I8x16GtU,
        wasmparser::Operator::I8x16LeS => Instruction::I8x16LeS,
        wasmparser::Operator::I8x16LeU => Instruction::I8x16LeU,
        wasmparser::Operator::I8x16GeS => Instruction::I8x16GeS,
        wasmparser::Operator::I8x16GeU => Instruction::I8x16GeU,
        wasmparser::Operator::I16x8Eq => Instruction::I16x8Eq,
        wasmparser::Operator::I16x8Ne => Instruction::I16x8Ne,
        wasmparser::Operator::I16x8LtS => Instruction::I16x8LtS,
        wasmparser::Operator::I16x8LtU => Instruction::I16x8LtU,
        wasmparser::Operator::I16x8GtS => Instruction::I16x8GtS,
        wasmparser::Operator::I16x8GtU => Instruction::I16x8GtU,
        wasmparser::Operator::I16x8LeS => Instruction::I16x8LeS,
        wasmparser::Operator::I16x8LeU => Instruction::I16x8LeU,
        wasmparser::Operator::I16x8GeS => Instruction::I16x8GeS,
        wasmparser::Operator::I16x8GeU => Instruction::I16x8GeU,
        wasmparser::Operator::I32x4Eq => Instruction::I32x4Eq,
        wasmparser::Operator::I32x4Ne => Instruction::I32x4Ne,
        wasmparser::Operator::I32x4LtS => Instruction::I32x4LtS,
        wasmparser::Operator::I32x4LtU => Instruction::I32x4LtU,
        wasmparser::Operator::I32x4GtS => Instruction::I32x4GtS,
        wasmparser::Operator::I32x4GtU => Instruction::I32x4GtU,
        wasmparser::Operator::I32x4LeS => Instruction::I32x4LeS,
        wasmparser::Operator::I32x4LeU => Instruction::I32x4LeU,
        wasmparser::Operator::I32x4GeS => Instruction::I32x4GeS,
        wasmparser::Operator::I32x4GeU => Instruction::I32x4GeU,
        wasmparser::Operator::I64x2Eq => Instruction::I64x2Eq,
        wasmparser::Operator::I64x2Ne => Instruction::I64x2Ne,
        wasmparser::Operator::I64x2LtS => Instruction::I64x2LtS,
        wasmparser::Operator::I64x2GtS => Instruction::I64x2GtS,
        wasmparser::Operator::I64x2LeS => Instruction::I64x2LeS,
        wasmparser::Operator::I64x2GeS => Instruction::I64x2GeS,
        wasmparser::Operator::F32x4Eq => Instruction::F32x4Eq,
        wasmparser::Operator::F32x4Ne => Instruction::F32x4Ne,
        wasmparser::Operator::F32x4Lt => Instruction::F32x4Lt,
        wasmparser::Operator::F32x4Gt => Instruction::F32x4Gt,
        wasmparser::Operator::F32x4Le => Instruction::F32x4Le,
        wasmparser::Operator::F32x4Ge => Instruction::F32x4Ge,
        wasmparser::Operator::F64x2Eq => Instruction::F64x2Eq,
        wasmparser::Operator::F64x2Ne => Instruction::F64x2Ne,
        wasmparser::Operator::F64x2Lt => Instruction::F64x2Lt,
        wasmparser::Operator::F64x2Gt => Instruction::F64x2Gt,
        wasmparser::Operator::F64x2Le => Instruction::F64x2Le,
        wasmparser::Operator::F64x2Ge => Instruction::F64x2Ge,
        wasmparser::Operator::V128Not => Instruction::V128Not,
        wasmparser::Operator::V128And => Instruction::V128And,
        wasmparser::Operator::V128AndNot => Instruction::V128AndNot,
        wasmparser::Operator::V128Or => Instruction::V128Or,
        wasmparser::Operator::V128Xor => Instruction::V128Xor,
        wasmparser::Operator::V128Bitselect => Instruction::V128Bitselect,
        wasmparser::Operator::V128AnyTrue => Instruction::V128AnyTrue,
        wasmparser::Operator::I8x16Abs => Instruction::I8x16Abs,
        wasmparser::Operator::I8x16Neg => Instruction::I8x16Neg,
        wasmparser::Operator::I8x16Popcnt => Instruction::I8x16Popcnt,
        wasmparser::Operator::I8x16AllTrue => Instruction::I8x16AllTrue,
        wasmparser::Operator::I8x16Bitmask => Instruction::I8x16Bitmask,
        wasmparser::Operator::I8x16NarrowI16x8S => Instruction::I8x16NarrowI16x8S,
        wasmparser::Operator::I8x16NarrowI16x8U => Instruction::I8x16NarrowI16x8U,
        wasmparser::Operator::I8x16Shl => Instruction::I8x16Shl,
        wasmparser::Operator::I8x16ShrS => Instruction::I8x16ShrS,
        wasmparser::Operator::I8x16ShrU => Instruction::I8x16ShrU,
        wasmparser::Operator::I8x16Add => Instruction::I8x16Add,
        wasmparser::Operator::I8x16AddSatS => Instruction::I8x16AddSatS,
        wasmparser::Operator::I8x16AddSatU => Instruction::I8x16AddSatU,
        wasmparser::Operator::I8x16Sub => Instruction::I8x16Sub,
        wasmparser::Operator::I8x16SubSatS => Instruction::I8x16SubSatS,
        wasmparser::Operator::I8x16SubSatU => Instruction::I8x16SubSatU,
        wasmparser::Operator::I8x16MinS => Instruction::I8x16MinS,
        wasmparser::Operator::I8x16MinU => Instruction::I8x16MinU,
        wasmparser::Operator::I8x16MaxS => Instruction::I8x16MaxS,
        wasmparser::Operator::I8x16MaxU => Instruction::I8x16MaxU,
        wasmparser::Operator::I8x16AvgrU => Instruction::I8x16AvgrU,
        wasmparser::Operator::I16x8ExtAddPairwiseI8x16S => Instruction::I16x8ExtAddPairwiseI8x16S,
        wasmparser::Operator::I16x8ExtAddPairwiseI8x16U => Instruction::I16x8ExtAddPairwiseI8x16U,
        wasmparser::Operator::I16x8Abs => Instruction::I16x8Abs,
        wasmparser::Operator::I16x8Neg => Instruction::I16x8Neg,
        wasmparser::Operator::I16x8Q15MulrSatS => Instruction::I16x8Q15MulrSatS,
        wasmparser::Operator::I16x8AllTrue => Instruction::I16x8AllTrue,
        wasmparser::Operator::I16x8Bitmask => Instruction::I16x8Bitmask,
        wasmparser::Operator::I16x8NarrowI32x4S => Instruction::I16x8NarrowI32x4S,
        wasmparser::Operator::I16x8NarrowI32x4U => Instruction::I16x8NarrowI32x4U,
        wasmparser::Operator::I16x8ExtendLowI8x16S => Instruction::I16x8ExtendLowI8x16S,
        wasmparser::Operator::I16x8ExtendHighI8x16S => Instruction::I16x8ExtendHighI8x16S,
        wasmparser::Operator::I16x8ExtendLowI8x16U => Instruction::I16x8ExtendLowI8x16U,
        wasmparser::Operator::I16x8ExtendHighI8x16U => Instruction::I16x8ExtendHighI8x16U,
        wasmparser::Operator::I16x8Shl => Instruction::I16x8Shl,
        wasmparser::Operator::I16x8ShrS => Instruction::I16x8ShrS,
        wasmparser::Operator::I16x8ShrU => Instruction::I16x8ShrU,
        wasmparser::Operator::I16x8Add => Instruction::I16x8Add,
        wasmparser::Operator::I16x8AddSatS => Instruction::I16x8AddSatS,
        wasmparser::Operator::I16x8AddSatU => Instruction::I16x8AddSatU,
        wasmparser::Operator::I16x8Sub => Instruction::I16x8Sub,
        wasmparser::Operator::I16x8SubSatS => Instruction::I16x8SubSatS,
        wasmparser::Operator::I16x8SubSatU => Instruction::I16x8SubSatU,
        wasmparser::Operator::I16x8Mul => Instruction::I16x8Mul,
        wasmparser::Operator::I16x8MinS => Instruction::I16x8MinS,
        wasmparser::Operator::I16x8MinU => Instruction::I16x8MinU,
        wasmparser::Operator::I16x8MaxS => Instruction::I16x8MaxS,
        wasmparser::Operator::I16x8MaxU => Instruction::I16x8MaxU,
        wasmparser::Operator::I16x8AvgrU => Instruction::I16x8AvgrU,
        wasmparser::Operator::I16x8ExtMulLowI8x16S => Instruction::I16x8ExtMulLowI8x16S,
        wasmparser::Operator::I16x8ExtMulHighI8x16S => Instruction::I16x8ExtMulHighI8x16S,
        wasmparser::Operator::I16x8ExtMulLowI8x16U => Instruction::I16x8ExtMulLowI8x16U,
        wasmparser::Operator::I16x8ExtMulHighI8x16U => Instruction::I16x8ExtMulHighI8x16U,
        wasmparser::Operator::I32x4ExtAddPairwiseI16x8S => Instruction::I32x4ExtAddPairwiseI16x8S,
        wasmparser::Operator::I32x4ExtAddPairwiseI16x8U => Instruction::I32x4ExtAddPairwiseI16x8U,
        wasmparser::Operator::I32x4Abs => Instruction::I32x4Abs,
        wasmparser::Operator::I32x4Neg => Instruction::I32x4Neg,
        wasmparser::Operator::I32x4AllTrue => Instruction::I32x4AllTrue,
        wasmparser::Operator::I32x4Bitmask => Instruction::I32x4Bitmask,
        wasmparser::Operator::I32x4ExtendLowI16x8S => Instruction::I32x4ExtendLowI16x8S,
        wasmparser::Operator::I32x4ExtendHighI16x8S => Instruction::I32x4ExtendHighI16x8S,
        wasmparser::Operator::I32x4ExtendLowI16x8U => Instruction::I32x4ExtendLowI16x8U,
        wasmparser::Operator::I32x4ExtendHighI16x8U => Instruction::I32x4ExtendHighI16x8U,
        wasmparser::Operator::I32x4Shl => Instruction::I32x4Shl,
        wasmparser::Operator::I32x4ShrS => Instruction::I32x4ShrS,
        wasmparser::Operator::I32x4ShrU => Instruction::I32x4ShrU,
        wasmparser::Operator::I32x4Add => Instruction::I32x4Add,
        wasmparser::Operator::I32x4Sub => Instruction::I32x4Sub,
        wasmparser::Operator::I32x4Mul => Instruction::I32x4Mul,
        wasmparser::Operator::I32x4MinS => Instruction::I32x4MinS,
        wasmparser::Operator::I32x4MinU => Instruction::I32x4MinU,
        wasmparser::Operator::I32x4MaxS => Instruction::I32x4MaxS,
        wasmparser::Operator::I32x4MaxU => Instruction::I32x4MaxU,
        wasmparser::Operator::I32x4DotI16x8S => Instruction::I32x4DotI16x8S,
        wasmparser::Operator::I32x4ExtMulLowI16x8S => Instruction::I32x4ExtMulLowI16x8S,
        wasmparser::Operator::I32x4ExtMulHighI16x8S => Instruction::I32x4ExtMulHighI16x8S,
        wasmparser::Operator::I32x4ExtMulLowI16x8U => Instruction::I32x4ExtMulLowI16x8U,
        wasmparser::Operator::I32x4ExtMulHighI16x8U => Instruction::I32x4ExtMulHighI16x8U,
        wasmparser::Operator::I64x2Abs => Instruction::I64x2Abs,
        wasmparser::Operator::I64x2Neg => Instruction::I64x2Neg,
        wasmparser::Operator::I64x2AllTrue => Instruction::I64x2AllTrue,
        wasmparser::Operator::I64x2Bitmask => Instruction::I64x2Bitmask,
        wasmparser::Operator::I64x2ExtendLowI32x4S => Instruction::I64x2ExtendLowI32x4S,
        wasmparser::Operator::I64x2ExtendHighI32x4S => Instruction::I64x2ExtendHighI32x4S,
        wasmparser::Operator::I64x2ExtendLowI32x4U => Instruction::I64x2ExtendLowI32x4U,
        wasmparser::Operator::I64x2ExtendHighI32x4U => Instruction::I64x2ExtendHighI32x4U,
        wasmparser::Operator::I64x2Shl => Instruction::I64x2Shl,
        wasmparser::Operator::I64x2ShrS => Instruction::I64x2ShrS,
        wasmparser::Operator::I64x2ShrU => Instruction::I64x2ShrU,
        wasmparser::Operator::I64x2Add => Instruction::I64x2Add,
        wasmparser::Operator::I64x2Sub => Instruction::I64x2Sub,
        wasmparser::Operator::I64x2Mul => Instruction::I64x2Mul,
        wasmparser::Operator::I64x2ExtMulLowI32x4S => Instruction::I64x2ExtMulLowI32x4S,
        wasmparser::Operator::I64x2ExtMulHighI32x4S => Instruction::I64x2ExtMulHighI32x4S,
        wasmparser::Operator::I64x2ExtMulLowI32x4U => Instruction::I64x2ExtMulLowI32x4U,
        wasmparser::Operator::I64x2ExtMulHighI32x4U => Instruction::I64x2ExtMulHighI32x4U,
        wasmparser::Operator::F32x4Ceil => Instruction::F32x4Ceil,
        wasmparser::Operator::F32x4Floor => Instruction::F32x4Floor,
        wasmparser::Operator::F32x4Trunc => Instruction::F32x4Trunc,
        wasmparser::Operator::F32x4Nearest => Instruction::F32x4Nearest,
        wasmparser::Operator::F32x4Abs => Instruction::F32x4Abs,
        wasmparser::Operator::F32x4Neg => Instruction::F32x4Neg,
        wasmparser::Operator::F32x4Sqrt => Instruction::F32x4Sqrt,
        wasmparser::Operator::F32x4Add => Instruction::F32x4Add,
        wasmparser::Operator::F32x4Sub => Instruction::F32x4Sub,
        wasmparser::Operator::F32x4Mul => Instruction::F32x4Mul,
        wasmparser::Operator::F32x4Div => Instruction::F32x4Div,
        wasmparser::Operator::F32x4Min => Instruction::F32x4Min,
        wasmparser::Operator::F32x4Max => Instruction::F32x4Max,
        wasmparser::Operator::F32x4PMin => Instruction::F32x4PMin,
        wasmparser::Operator::F32x4PMax => Instruction::F32x4PMax,
        wasmparser::Operator::F64x2Ceil => Instruction::F64x2Ceil,
        wasmparser::Operator::F64x2Floor => Instruction::F64x2Floor,
        wasmparser::Operator::F64x2Trunc => Instruction::F64x2Trunc,
        wasmparser::Operator::F64x2Nearest => Instruction::F64x2Nearest,
        wasmparser::Operator::F64x2Abs => Instruction::F64x2Abs,
        wasmparser::Operator::F64x2Neg => Instruction::F64x2Neg,
        wasmparser::Operator::F64x2Sqrt => Instruction::F64x2Sqrt,
        wasmparser::Operator::F64x2Add => Instruction::F64x2Add,
        wasmparser::Operator::F64x2Sub => Instruction::F64x2Sub,
        wasmparser::Operator::F64x2Mul => Instruction::F64x2Mul,
        wasmparser::Operator::F64x2Div => Instruction::F64x2Div,
        wasmparser::Operator::F64x2Min => Instruction::F64x2Min,
        wasmparser::Operator::F64x2Max => Instruction::F64x2Max,
        wasmparser::Operator::F64x2PMin => Instruction::F64x2PMin,
        wasmparser::Operator::F64x2PMax => Instruction::F64x2PMax,
        wasmparser::Operator::I32x4TruncSatF32x4S => Instruction::I32x4TruncSatF32x4S,
        wasmparser::Operator::I32x4TruncSatF32x4U => Instruction::I32x4TruncSatF32x4U,
        wasmparser::Operator::F32x4ConvertI32x4S => Instruction::F32x4ConvertI32x4S,
        wasmparser::Operator::F32x4ConvertI32x4U => Instruction::F32x4ConvertI32x4U,
        wasmparser::Operator::I32x4TruncSatF64x2SZero => Instruction::I32x4TruncSatF64x2SZero,
        wasmparser::Operator::I32x4TruncSatF64x2UZero => Instruction::I32x4TruncSatF64x2UZero,
        wasmparser::Operator::F64x2ConvertLowI32x4S => Instruction::F64x2ConvertLowI32x4S,
        wasmparser::Operator::F64x2ConvertLowI32x4U => Instruction::F64x2ConvertLowI32x4U,
        wasmparser::Operator::F32x4DemoteF64x2Zero => Instruction::F32x4DemoteF64x2Zero,
        wasmparser::Operator::F64x2PromoteLowF32x4 => Instruction::F64x2PromoteLowF32x4,
        wasmparser::Operator::I8x16RelaxedSwizzle => Instruction::I8x16RelaxedSwizzle,
        wasmparser::Operator::I8x16RelaxedLaneselect => Instruction::I8x16RelaxedLaneselect,
        wasmparser::Operator::I16x8RelaxedLaneselect => Instruction::I16x8RelaxedLaneselect,
        wasmparser::Operator::I32x4RelaxedLaneselect => Instruction::I32x4RelaxedLaneselect,
        wasmparser::Operator::I64x2RelaxedLaneselect => Instruction::I64x2RelaxedLaneselect,
        wasmparser::Operator::F32x4RelaxedMin => Instruction::F32x4RelaxedMin,
        wasmparser::Operator::F32x4RelaxedMax => Instruction::F32x4RelaxedMax,
        wasmparser::Operator::F64x2RelaxedMin => Instruction::F64x2RelaxedMin,
        wasmparser::Operator::F64x2RelaxedMax => Instruction::F64x2RelaxedMax,
        wasmparser::Operator::I16x8RelaxedQ15mulrS => Instruction::I16x8RelaxedQ15mulrS,
        wasmparser::Operator::MemoryDiscard { .. } => todo!("memory discard"),
        wasmparser::Operator::I32x4RelaxedTruncF32x4S => Instruction::I32x4RelaxedTruncF32x4S,
        wasmparser::Operator::I32x4RelaxedTruncF32x4U => Instruction::I32x4RelaxedTruncF32x4U,
        wasmparser::Operator::I32x4RelaxedTruncF64x2SZero => {
            Instruction::I32x4RelaxedTruncF64x2SZero
        }
        wasmparser::Operator::I32x4RelaxedTruncF64x2UZero => {
            Instruction::I32x4RelaxedTruncF64x2UZero
        }
        wasmparser::Operator::F32x4RelaxedMadd => Instruction::F32x4RelaxedMadd,
        wasmparser::Operator::F32x4RelaxedNmadd => Instruction::F32x4RelaxedNmadd,
        wasmparser::Operator::F64x2RelaxedMadd => Instruction::F64x2RelaxedMadd,
        wasmparser::Operator::F64x2RelaxedNmadd => Instruction::F64x2RelaxedNmadd,
        wasmparser::Operator::I16x8RelaxedDotI8x16I7x16S => Instruction::I16x8RelaxedDotI8x16I7x16S,
        wasmparser::Operator::I32x4RelaxedDotI8x16I7x16AddS => {
            Instruction::I32x4RelaxedDotI8x16I7x16AddS
        }
    }
}
