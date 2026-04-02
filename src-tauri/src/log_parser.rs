use regex::Regex;
use std::sync::OnceLock;

fn hashrate_regex() -> &'static Regex {
    static HASHRATE_REGEX: OnceLock<Regex> = OnceLock::new();
    HASHRATE_REGEX.get_or_init(|| {
        Regex::new(r"(?i)(?P<value>\d+(?:[.,]\d+)?)\s*(?P<unit>(?:[kmgtp]?h/s)|(?:sol/s))")
            .expect("valid hashrate regex")
    })
}

pub fn parse_hashrate(line: &str) -> Option<String> {
    let captures = hashrate_regex().captures(line)?;
    let value = captures.name("value")?.as_str().replace(',', ".");
    let unit = captures.name("unit")?.as_str().to_uppercase();
    Some(format!("{value} {unit}"))
}

#[cfg(test)]
mod tests {
    use super::parse_hashrate;

    #[test]
    fn parses_standard_mhs_lines() {
        assert_eq!(
            parse_hashrate("GPU0 speed 12.45 MH/s"),
            Some("12.45 MH/S".into())
        );
    }

    #[test]
    fn parses_comma_decimal_lines() {
        assert_eq!(
            parse_hashrate("hashrate: 1,23 kH/s"),
            Some("1.23 KH/S".into())
        );
    }

    #[test]
    fn parses_sol_lines() {
        assert_eq!(
            parse_hashrate("GPU total 18.7 Sol/s"),
            Some("18.7 SOL/S".into())
        );
    }
}
