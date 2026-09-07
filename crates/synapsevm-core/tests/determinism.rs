use synapsevm_core::{
    decode_loomguard, hash_input, init, q16, restore, snapshot, state_root_of, step, HelloBlock,
    TraceMode,
};

#[test]
fn hello_reflex_case_001_is_bit_identical() {
    let block = HelloBlock::build();

    let run = || {
        let mut state = init(&block).expect("init");
        let mut last = None;
        let mut total_fired = 0u32;
        let mut motor_high = false;
        for tick in 0u64..16 {
            let input = [q16(0.4)];
            let result = step(&mut state, &input, tick, TraceMode::Sparse).expect("step");
            total_fired += result.fired_count;
            if result.loom.trigger || result.output.last().copied().unwrap_or(0) != 0 {
                motor_high = true;
            }
            last = Some((result, total_fired, motor_high));
        }
        last.expect("at least one step")
    };

    let (a, a_fired, a_motor) = run();
    let (b, b_fired, b_motor) = run();

    assert_eq!(a.output, b.output);
    assert_eq!(a.state_root, b.state_root);
    assert_eq!(a.trace_root, b.trace_root);
    assert_eq!(a_fired, b_fired);
    assert!(a_fired > 0);
    assert!(a_motor && b_motor);
}

#[test]
fn two_independent_vms_stay_in_lockstep() {
    let block = HelloBlock::build();
    let mut left = init(&block).unwrap();
    let mut right = init(&block).unwrap();

    for tick in 0u64..32 {
        let input = if tick % 3 == 0 { [q16(0.5)] } else { [0] };
        let a = step(&mut left, &input, tick, TraceMode::Off).unwrap();
        let b = step(&mut right, &input, tick, TraceMode::Off).unwrap();
        assert_eq!(a.output, b.output);
        assert_eq!(a.state_root, b.state_root);
    }
}

#[test]
fn snapshot_restore_is_deterministic() {
    let block = HelloBlock::build();
    let mut state = init(&block).unwrap();
    for tick in 0..5 {
        let _ = step(&mut state, &[q16(0.5)], tick, TraceMode::Off).unwrap();
    }
    let snap = snapshot(&state);
    let root = state_root_of(&state);
    let mut other = init(&block).unwrap();
    restore(&mut other, &snap).unwrap();
    assert_eq!(state_root_of(&other), root);
    let _ = decode_loomguard(&state);
    let _ = hash_input(&[1, 2, 3]);
}
