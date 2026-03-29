pub fn parse_hashrate(line: &str) -> Option<String> {
    let lowered = line.to_lowercase();
    let units = ["th/s", "gh/s", "mh/s", "kh/s", "h/s"];

    for unit in units {
        if let Some(index) = lowered.find(unit) {
            let prefix = &line[..index];
            let numeric: String = prefix
                .chars()
                .rev()
                .take_while(|char| char.is_ascii_digit() || *char == '.' || char.is_whitespace())
                .collect::<String>()
                .chars()
                .rev()
                .collect();

            let candidate = numeric.trim();
            if !candidate.is_empty() {
                return Some(format!("{candidate} {}", unit.to_uppercase()));
            }
        }
    }

    None
}
