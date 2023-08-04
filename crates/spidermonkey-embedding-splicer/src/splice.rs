use anyhow::Result;
use walrus::{
    ir::{
        BinaryOp, Binop, Call, Const, Load, LoadKind, MemArg, Store, StoreKind, UnaryOp, Unop,
        Value,
    },
    ir::{Instr, LocalGet, LocalSet, LocalTee},
    ExportId, ExportItem, FunctionBuilder, FunctionId, LocalId, ValType,
};

use crate::*;

//
// Parses the Spidermonkey binary into section data for reserialization
// into an output binary, and in the process:
//
// 1. Imported function bindings are generated. This is based on splicing
//    together the core binding steps that are deconstructed from the
//    "coreabi-sample" template, and that function is then removed entirely.
//    Import functions are then placed into the table for indirect call
//    referencing.
//
//    The following sample functions are used for imports:
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
//
pub fn splice(
    engine: Vec<u8>,
    imports: Vec<(String, String, CoreFn, Option<i32>)>,
    exports: Vec<(String, CoreFn)>,
    debug: bool,
) -> Result<Vec<u8>> {
    let config = walrus::ModuleConfig::new();
    let mut module = config.parse(&engine)?;

    // extract the native instructions from sample functions
    // then inline the imported functions and main import gating function
    // (erasing sample functions in the process)
    synthesize_import_functions(&mut module, &imports, debug)?;

    // create the exported functions as wrappers around the "cabi_call" function
    synthesize_export_functions(&mut module, &exports)?;

    Ok(module.emit_wasm())
}

fn get_export_fid(module: &walrus::Module, expt_id: &ExportId) -> FunctionId {
    match &module.exports.get(*expt_id).item {
        ExportItem::Function(fid) => *fid,
        _ => panic!("Missing coreabi_get_import"),
    }
}

fn synthesize_import_functions(
    module: &mut walrus::Module,
    imports: &Vec<(String, String, CoreFn, Option<i32>)>,
    debug: bool,
) -> Result<()> {
    let mut coreabi_get_import: Option<ExportId> = None;
    let mut cabi_realloc: Option<ExportId> = None;

    let mut coreabi_sample_ids = Vec::new();
    for expt in module.exports.iter() {
        let id = expt.id();
        match expt.name.as_str() {
            "coreabi_sample_i32" | "coreabi_sample_i64" | "coreabi_sample_f32"
            | "coreabi_sample_f64" => coreabi_sample_ids.push(id),
            "coreabi_get_import" => coreabi_get_import = Some(id),
            "cabi_realloc" => cabi_realloc = Some(id),
            _ => {}
        };
    }

    let memory = module.memories.iter().nth(0).unwrap().id();
    let main_tid = module.tables.main_function_table()?.unwrap();
    let import_fn_table_start_idx = module.tables.get(main_tid).initial as i32;

    let cabi_realloc_fid = get_export_fid(module, &cabi_realloc.unwrap());

    let coreabi_sample_fid = get_export_fid(module, coreabi_sample_ids.first().unwrap());
    let coreabi_sample_i32 = module.funcs.get(coreabi_sample_fid).kind.unwrap_local();

    // These functions retrieve the corresponding type
    // from a JS::HandleValue
    // All except for the BigInt one are trivial and thus
    // do not require regular explicit template extraction
    // unless there are major ABI changes in Spidermonkey
    let args_get_i32: Vec<Instr> = vec![
        Instr::Load(Load {
            memory,
            kind: LoadKind::I64 { atomic: false },
            arg: MemArg {
                align: 8,
                offset: 0,
            },
        }),
        Instr::Unop(Unop {
            op: UnaryOp::I32WrapI64,
        }),
    ];

    let coreabi_from_bigint64 = module
        .exports
        .iter()
        .find(|expt| expt.name.as_str() == "coreabi_from_bigint64")
        .unwrap()
        .id();
    let args_get_i64: Vec<Instr> = vec![Instr::Call(Call {
        func: get_export_fid(&module, &coreabi_from_bigint64),
    })];

    let args_get_f32: Vec<Instr> = vec![
        Instr::Load(Load {
            memory,
            kind: LoadKind::F64,
            arg: MemArg {
                align: 8,
                offset: 0,
            },
        }),
        Instr::Unop(Unop {
            op: UnaryOp::F32DemoteF64,
        }),
    ];

    let args_get_f64: Vec<Instr> = vec![Instr::Load(Load {
        memory,
        kind: LoadKind::F64,
        arg: MemArg {
            align: 8,
            offset: 0,
        },
    })];

    // Sets the return value on args from the stack
    let args_ret_i32: Vec<Instr> = vec![
        Instr::Unop(Unop {
            op: UnaryOp::I64ExtendUI32,
        }),
        Instr::Const(Const {
            value: Value::I64(-545460846592),
        }),
        Instr::Binop(Binop {
            op: BinaryOp::I64Or,
        }),
        Instr::Store(Store {
            memory,
            kind: StoreKind::I64 { atomic: false },
            arg: MemArg {
                align: 8,
                offset: 0,
            },
        }),
    ];

    // BigInt instructions are a little more involved as we need to extract
    // the separate ToBigInt call from the get_i64 sample
    let coreabi_to_bigint64 = module
        .exports
        .iter()
        .find(|expt| expt.name.as_str() == "coreabi_to_bigint64")
        .unwrap()
        .id();
    let args_ret_i64: Vec<Instr> = vec![
        Instr::Call(Call {
            func: get_export_fid(&module, &coreabi_to_bigint64),
        }),
        Instr::Unop(Unop {
            op: UnaryOp::I64ExtendUI32,
        }),
        Instr::Const(Const {
            value: Value::I64(-511101108224),
        }),
        Instr::Binop(Binop {
            op: BinaryOp::I64Or,
        }),
        Instr::Store(Store {
            memory,
            kind: StoreKind::I64 { atomic: false },
            arg: MemArg {
                align: 8,
                offset: 0,
            },
        }),
    ];
    let args_ret_f32: Vec<Instr> = vec![
        Instr::Unop(Unop {
            op: UnaryOp::F64PromoteF32,
        }),
        Instr::Store(Store {
            memory,
            kind: StoreKind::F64,
            arg: MemArg {
                align: 8,
                offset: 0,
            },
        }),
    ];
    let args_ret_f64: Vec<Instr> = vec![Instr::Store(Store {
        memory,
        kind: StoreKind::F64,
        arg: MemArg {
            align: 8,
            offset: 0,
        },
    })];

    // create the import functions
    // All JS wrapper function bindings have the same type, the
    // the Spidermonkey native function binding type:
    //
    //     bool NativeFn(JSContext *cx, unsigned argc, JS::Value *vp)
    //
    let mut import_fnids: Vec<FunctionId> = Vec::new();
    {
        // synthesized native import function parameters (in order)
        let ctx_arg = coreabi_sample_i32.args[0];
        let argc_arg = coreabi_sample_i32.args[1];
        let vp_arg = coreabi_sample_i32.args[2];

        // if we need to tee the retptr
        let retptr_local = module.locals.add(ValType::I32);
        let v8_local = module.locals.add(ValType::I64);

        for (impt_specifier, impt_name, impt_sig, retptr_size) in imports.iter() {
            if debug {
                println!(
                    "> IMPORT {} {} > {:?}",
                    impt_specifier, impt_name, &impt_sig
                );
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
            let ret = match impt_sig.ret {
                Some(ty) => vec![match ty {
                    CoreTy::I32 => ValType::I32,
                    CoreTy::I64 => ValType::I64,
                    CoreTy::F32 => ValType::F32,
                    CoreTy::F64 => ValType::F64,
                }],
                None => vec![],
            };
            let import_fn_type = module.types.add(&params, &ret);
            let (import_fn_fid, _) =
                module.add_import_func(&impt_specifier, &impt_name, import_fn_type);

            // create the native JS binding function
            let mut func = FunctionBuilder::new(
                &mut module.types,
                &vec![ValType::I32, ValType::I32, ValType::I32],
                &vec![ValType::I32],
            );

            let mut func_body = func.func_body();

            // copy the prelude instructions from the sample function (first block)
            let coreabi_sample_i32 = module.funcs.get(coreabi_sample_fid).kind.unwrap_local();
            let prelude_seq = coreabi_sample_i32
                .block(coreabi_sample_i32.entry_block())
                .instrs[0]
                .0
                .unwrap_block()
                .seq;

            let prelude_block = coreabi_sample_i32.block(prelude_seq);
            func_body.block(None, |prelude| {
                for (instr, _) in &prelude_block.instrs {
                    match instr {
                        Instr::LocalGet(LocalGet { local }) => {
                            if local.eq(&vp_arg) {
                                prelude.instr(instr.clone());
                            } else {
                                prelude.local_get(v8_local);
                            }
                        }
                        Instr::LocalSet(LocalSet { local }) => {
                            if local.eq(&vp_arg) {
                                prelude.instr(instr.clone());
                            } else {
                                prelude.local_set(v8_local);
                            }
                        }
                        Instr::LocalTee(LocalTee { local }) => {
                            if local.eq(&vp_arg) {
                                prelude.instr(instr.clone());
                            } else {
                                prelude.local_tee(v8_local);
                            }
                        }
                        Instr::BrIf(_) => {
                            prelude.br_if(prelude.id());
                        }
                        _ => {
                            prelude.instr(instr.clone());
                        }
                    };
                }
            });

            // stack the return arg now as it chains with the
            // args we're about to add to the stack
            if impt_sig.ret.is_some() {
                func_body.local_get(vp_arg);

                // if an i64 return, then we need to stack the extra BigInt constructor arg for that now
                if matches!(impt_sig.ret.unwrap(), CoreTy::I64) {
                    func_body.local_get(ctx_arg);
                }
            }

            for (idx, arg) in impt_sig.params.iter().enumerate() {
                // for retptr, we must explicitly created it rather than receiving it
                if impt_sig.retptr && idx == impt_sig.params.len() - 1 {
                    break;
                }
                // JS args
                func_body.local_get(vp_arg);
                // JS args offset
                func_body.i32_const(16 + 8 * idx as i32);
                func_body.binop(BinaryOp::I32Add);
                match arg {
                    CoreTy::I32 => args_get_i32.iter().for_each(|instr| {
                        func_body.instr(instr.clone());
                    }),
                    CoreTy::I64 => args_get_i64.iter().for_each(|instr| {
                        func_body.instr(instr.clone());
                    }),
                    CoreTy::F32 => args_get_f32.iter().for_each(|instr| {
                        func_body.instr(instr.clone());
                    }),
                    CoreTy::F64 => args_get_f64.iter().for_each(|instr| {
                        func_body.instr(instr.clone());
                    }),
                };
            }

            // if a retptr,
            // allocate and put the retptr on the call stack as the last passed argument
            if impt_sig.retptr {
                assert!(!impt_sig.ret.is_some());
                // prepare the context arg for the return set shortly
                func_body.local_get(vp_arg);

                // allocate the retptr
                func_body.i32_const(0);
                func_body.i32_const(0);
                func_body.i32_const(4);
                // Last realloc arg is byte length to allocate
                func_body.i32_const(retptr_size.unwrap());

                // Call realloc, getting back the retptr
                func_body.call(cabi_realloc_fid);

                // tee the retptr into a local
                func_body.local_tee(retptr_local);

                // also set the retptr as the return value of the JS function
                // (consumes the context arg above)
                args_ret_i32.iter().for_each(|instr| {
                    func_body.instr(instr.clone());
                });

                // add the retptr back on the stack for the call
                func_body.local_get(retptr_local);
            }

            // main call to the import lowering function
            func_body.call(import_fn_fid);

            match impt_sig.ret {
                None => {}
                Some(CoreTy::I32) => args_ret_i32.iter().for_each(|instr| {
                    func_body.instr(instr.clone());
                }),
                Some(CoreTy::I64) => args_ret_i64.iter().for_each(|instr| {
                    func_body.instr(instr.clone());
                }),
                Some(CoreTy::F32) => args_ret_f32.iter().for_each(|instr| {
                    func_body.instr(instr.clone());
                }),
                Some(CoreTy::F64) => args_ret_f64.iter().for_each(|instr| {
                    func_body.instr(instr.clone());
                }),
            }

            // return true
            func_body.i32_const(1);

            let fid = func.finish(vec![ctx_arg, argc_arg, vp_arg], &mut module.funcs);
            import_fnids.push(fid);
        }

        // extend the main table to include indices for generated imported functions
        let table = module.tables.get_mut(main_tid);
        table.initial += imports.len() as u32;
        table.maximum = Some(table.maximum.unwrap() + imports.len() as u32);

        // create imported function table
        let els = module.elements.iter_mut().next().unwrap();
        for fid in import_fnids {
            els.members.push(Some(fid.clone()));
        }
    }

    // Populate the import creation function of the form:
    //
    // This function already exists, we just have to fixup the contents to the right <baseidx>
    //
    // JSFunction *coreabi_get_import(int32_t idx, int32_t argcnt, const char *name) {
    //   return JS_NewFunction(R.cx, <baseidx> + idx, argcnt, name);
    // }
    //
    {
        let coreabi_get_import_fid = get_export_fid(module, &coreabi_get_import.unwrap());

        let args = &module
            .funcs
            .get(coreabi_get_import_fid)
            .kind
            .unwrap_local()
            .args;
        let arg_idx = args[0].clone();

        let builder: &mut FunctionBuilder = &mut module
            .funcs
            .get_mut(coreabi_get_import_fid)
            .kind
            .unwrap_local_mut()
            .builder_mut();

        let mut func_body = builder.func_body();

        // walk until we get to the const 1
        let mut table_instr_idx = 0;
        for (idx, (instr, _)) in func_body.instrs_mut().iter_mut().enumerate() {
            if let Instr::Const(Const {
                value: Value::I32(ref mut v),
            }) = instr
            {
                if *v == 1 {
                    *v = import_fn_table_start_idx;
                    table_instr_idx = idx;
                    break;
                }
            }
        }
        func_body.local_get_at(table_instr_idx, arg_idx);
        func_body.binop_at(table_instr_idx + 2, BinaryOp::I32Add);
    }

    // remove unnecessary exports
    module.exports.delete(coreabi_to_bigint64);
    module.exports.delete(coreabi_from_bigint64);
    module.exports.delete(coreabi_get_import.unwrap());
    for id in coreabi_sample_ids {
        module.exports.delete(id);
    }

    Ok(())
}

fn synthesize_export_functions(
    module: &mut walrus::Module,
    exports: &Vec<(String, CoreFn)>,
) -> Result<()> {
    let cabi_realloc = get_export_fid(
        module,
        &module
            .exports
            .iter()
            .find(|expt| expt.name.as_str() == "cabi_realloc")
            .unwrap()
            .id(),
    );
    let call_expt = module
        .exports
        .iter()
        .find(|expt| expt.name.as_str() == "call")
        .unwrap()
        .id();
    let call = get_export_fid(module, &call_expt);
    let post_call_expt = module
        .exports
        .iter()
        .find(|expt| expt.name.as_str() == "post_call")
        .unwrap()
        .id();
    let post_call = get_export_fid(module, &post_call_expt);

    let memory = module.memories.iter().nth(0).unwrap().id();

    // (2) Export call function synthesis
    let arg_ptr = module.locals.add(ValType::I32);
    let ret_ptr = module.locals.add(ValType::I32);
    for (export_num, (expt_name, expt_sig)) in exports.iter().enumerate() {
        // Export function synthesis
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
            let ret = expt_sig
                .ret
                .iter()
                .map(|ty| match ty {
                    CoreTy::I32 => ValType::I32,
                    CoreTy::I64 => ValType::I64,
                    CoreTy::F32 => ValType::F32,
                    CoreTy::F64 => ValType::F64,
                })
                .collect::<Vec<ValType>>();

            let mut func = FunctionBuilder::new(&mut module.types, &params, &ret);
            func.name(expt_name.to_string());
            let func_body = &mut func.func_body();
            let args: Vec<LocalId> = params
                .iter()
                .map(|param| module.locals.add(*param))
                .collect();

            // Stack "call" arg1 - export number to call
            func_body.i32_const(export_num as i32);

            // Now we just have to add the argptr
            if expt_sig.params.len() == 0 {
                func_body.i32_const(0);
            } else if expt_sig.paramptr {
                // param ptr is the first arg with indirect params
                func_body.local_get(args[0]);
            } else {
                // realloc call to allocate params
                func_body.i32_const(0);
                func_body.i32_const(0);
                func_body.i32_const(4);
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
                func_body.i32_const(byte_size);
                // Call realloc, getting back the argptr
                func_body.call(cabi_realloc);

                // Tee the argptr into its local var
                func_body.local_tee(arg_ptr);

                let mut offset = 0;
                for (idx, param) in expt_sig.params.iter().enumerate() {
                    func_body.local_get(args[idx]);
                    match param {
                        CoreTy::I32 => {
                            func_body.store(
                                memory,
                                StoreKind::I32 { atomic: false },
                                MemArg { align: 4, offset },
                            );
                            offset += 4;
                        }
                        CoreTy::I64 => {
                            func_body.store(
                                memory,
                                StoreKind::I64 { atomic: false },
                                MemArg { align: 8, offset },
                            );
                            offset += 8;
                        }
                        CoreTy::F32 => {
                            func_body.store(memory, StoreKind::F32, MemArg { align: 4, offset });
                            offset += 4;
                        }
                        CoreTy::F64 => {
                            func_body.store(memory, StoreKind::F64, MemArg { align: 8, offset });
                            offset += 8;
                        }
                    }
                    func_body.local_get(arg_ptr);
                }

                // argptr stays on stack
            }

            // Call "call" (returns retptr)
            func_body.call(call);

            if expt_sig.ret.is_none() {
                func_body.drop();
            } else if !expt_sig.retptr {
                // Tee retptr into its local var
                func_body.local_tee(ret_ptr);

                // if it's a direct return, we must read the return
                // value type from the retptr
                match expt_sig.ret.unwrap() {
                    CoreTy::I32 => {
                        func_body.load(
                            memory,
                            LoadKind::I32 { atomic: false },
                            MemArg {
                                align: 4,
                                offset: 0,
                            },
                        );
                    }
                    CoreTy::I64 => {
                        func_body.load(
                            memory,
                            LoadKind::I64 { atomic: false },
                            MemArg {
                                align: 8,
                                offset: 0,
                            },
                        );
                    }
                    CoreTy::F32 => {
                        func_body.load(
                            memory,
                            LoadKind::F32,
                            MemArg {
                                align: 4,
                                offset: 0,
                            },
                        );
                    }
                    CoreTy::F64 => {
                        func_body.load(
                            memory,
                            LoadKind::F64,
                            MemArg {
                                align: 8,
                                offset: 0,
                            },
                        );
                    }
                }
            }

            let fid = func.finish(args, &mut module.funcs);

            module.exports.add(&expt_name, ExportItem::Function(fid));
        }

        // Post export function synthesis
        {
            // add the function type
            let mut func = FunctionBuilder::new(&mut module.types, &[ValType::I32], &[]);
            func.name(format!("post_{}", expt_name));
            let mut func_body = func.func_body();

            // calls post_call with just the function number argument
            // internally post_call is already tracking the frees needed
            // and that is currently done based on timing assumptions of calls
            func_body.i32_const(export_num as i32);
            func_body.call(post_call);
            let fid = func.finish(vec![], &mut module.funcs);

            module.exports.add(
                &format!("cabi_post_{}", expt_name),
                ExportItem::Function(fid),
            );
        }
    }

    // remove unnecessary exports
    module.exports.delete(call_expt);
    module.exports.delete(post_call_expt);

    Ok(())
}
