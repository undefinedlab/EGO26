use serde::{Deserialize, Serialize};

use crate::fixed::{self, FixedQ16};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LifParams {
    pub leak: FixedQ16,
    pub threshold: FixedQ16,
    pub reset: FixedQ16,
}

impl Default for LifParams {
    fn default() -> Self {
        Self {
            leak: fixed::q16(0.92),
            threshold: fixed::q16(1.0),
            reset: 0,
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct NeuronState {
    pub v: FixedQ16,
    pub spiked: bool,
}

impl NeuronState {
    pub fn tick(&mut self, params: &LifParams, input: FixedQ16) -> bool {
        let leaked = fixed::mul(self.v, params.leak);
        self.v = fixed::saturating_add(leaked, input);
        if self.v >= params.threshold {
            self.spiked = true;
            self.v = params.reset;
            true
        } else {
            self.spiked = false;
            false
        }
    }
}
