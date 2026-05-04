use serde::Serialize;

#[derive(Serialize)]
struct Health {
    status: String,
}

fn main() {
    let health = Health {
        status: "ok".to_string(),
    };
    println!("{}", serde_json::to_string(&health).unwrap());
}
