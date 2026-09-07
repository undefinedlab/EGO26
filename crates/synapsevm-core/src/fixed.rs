//! Q16.16 fixed-point helpers with saturating arithmetic.

pub type FixedQ16 = i32;

pub const ONE: FixedQ16 = 1 << 16;

#[allow(dead_code)]
pub const HALF: FixedQ16 = 1 << 15;

pub fn q16(v: f64) -> FixedQ16 {
    let scaled = (v * (ONE as f64)).round();
    if scaled >= i32::MAX as f64 {
        i32::MAX
    } else if scaled <= i32::MIN as f64 {
        i32::MIN
    } else {
        scaled as i32
    }
}

#[inline]
pub fn saturating_add(a: FixedQ16, b: FixedQ16) -> FixedQ16 {
    a.saturating_add(b)
}

#[inline]
pub fn mul(a: FixedQ16, b: FixedQ16) -> FixedQ16 {
    let wide = (a as i64) * (b as i64);
    let shifted = wide >> 16;
    if shifted > i32::MAX as i64 {
        i32::MAX
    } else if shifted < i32::MIN as i64 {
        i32::MIN
    } else {
        shifted as i32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_times_half_is_half() {
        assert_eq!(mul(ONE, HALF), HALF);
    }
}
