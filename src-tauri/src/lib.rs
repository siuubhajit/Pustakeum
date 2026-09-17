pub mod commands;
pub mod converter;
pub mod database;
pub mod engine;
pub mod search;
pub mod server;

use database::queries::{self, BookView};
use database::Database;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

pub struct AppState {
    pub db: Database,
    pub storage_dir: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenBookResponse {
    pub book: BookView,
    pub epub_data: Option<engine::epub::EpubBook>,
    pub comic_data: Option<engine::comics::ComicManifest>,
    pub pdf_data: Option<engine::pdf::PdfMetadata>,
}

// Seed sample books if database is newly initialized
pub fn seed_sample_library_if_empty(db: &Database, storage_dir: &Path) {
    let conn = db.lock_conn();
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM books", [], |r| r.get(0))
        .unwrap_or(0);

    if count == 0 {
        let sample_books_dir = storage_dir.join("sample_books");
        let _ = fs::create_dir_all(&sample_books_dir);

        // 1. The Bhagavad Gita (Philosophy)
        let gita_path = sample_books_dir.join("The_Bhagavad_Gita.txt");
        let gita_content = r#"# The Bhagavad Gita (श्रीमद्भगवद्गीता)

## Chapter 1: The Distress of Arjuna
Dhritarashtra said: O Sanjaya, assembled on the holy field of Kurukshetra, eager to fight, what did my sons and the sons of Pandu do?
Arjuna looked upon both armies and saw fathers, grandfathers, teachers, maternal uncles, brothers, sons, grandsons, and companions. Overcome with deep compassion and sorrow, he spoke: "Seeing these my kinsmen gathered here eager to battle, my limbs fail, my mouth is parched, my body trembles and my hair stands on end."

## Chapter 2: Yoga of Knowledge (Sankhya Yoga)
Lord Krishna said: "You grieve for those who should not be grieved for, yet you speak words of wisdom. The wise grieve neither for the living nor for the dead.
Never was there a time when I did not exist, nor you, nor all these kings; nor in the future shall any of us cease to be.
As the embodied soul continuously passes, in this body, from boyhood to youth to old age, the soul similarly passes into another body at death. The unperturbed person is not deluded by such a change."

## Chapter 3: The Yoga of Action (Karma Yoga)
"Perform your prescribed duty, for action is better than inaction. Even the maintenance of your body would not be possible without work.
Therefore, without being attached to the fruits of activities, one should act as a matter of duty; for by working without attachment one attains the Supreme."
"#;
        let _ = fs::write(&gita_path, gita_content);
        let gita_hash = blake3::hash(gita_content.as_bytes()).to_hex().to_string();

        let _ = queries::insert_book(
            &conn,
            &uuid::Uuid::new_v4().to_string(),
            &gita_hash,
            "The Bhagavad Gita (श्रीमद्भगवद्गीता)",
            gita_path.to_str().unwrap(),
            gita_content.len() as i64,
            "TXT",
            3,
            &vec!["Vyasa".to_string(), "S. Radhakrishnan (Trans.)".to_string()],
            Some("Sacred Manuscripts"),
            Some(1.0),
            &vec!["Philosophy".to_string(), "Yoga".to_string(), "Classics".to_string()],
            Some("Pustakeum Classical Press"),
            Some(1948),
            Some("The ancient philosophical dialogue between Prince Arjuna and Lord Krishna on duty, yoga, and ultimate reality on the battlefield of Kurukshetra."),
            Some("978-0060667955"),
            None,
        );

        // 2. Surya Siddhanta (Ancient Indian Astronomy & Mathematics)
        let surya_path = sample_books_dir.join("Surya_Siddhanta.txt");
        let surya_content = r#"# Surya Siddhanta: A Text-Book of Hindu Astronomy

## Chapter 1: The Mean Motions of the Planets
To Him whose shape is of the Sun, the source of light, life, and knowledge, be reverent salutation.
In the ancient Golden Age (Satya Yuga), a great solar deity revealed unto Maya the demon-architect the eternal motions of the planetary orbs, the measures of celestial time, and the circumferences of the sidereal spheres.

## Chapter 2: On the True Places of the Planets
Time is of two orders: that which destroys the world (Mahakala), and that which is measurable and comprehensible (Kalana).
The solar year is divided into twelve solar months; the circle of the zodiac contains 360 degrees, each degree 60 minutes, and each minute 60 seconds.
The distance of the sun and moon, the calculation of eclipses, and the declination of the lunar nodes are computed through sine tables (Jya and Kojya) and planetary epicycles.
"#;
        let _ = fs::write(&surya_path, surya_content);
        let surya_hash = blake3::hash(surya_content.as_bytes()).to_hex().to_string();

        let _ = queries::insert_book(
            &conn,
            &uuid::Uuid::new_v4().to_string(),
            &surya_hash,
            "Surya Siddhanta (सूर्यसिद्धान्त)",
            surya_path.to_str().unwrap(),
            surya_content.len() as i64,
            "TXT",
            2,
            &vec!["Aryabhata".to_string(), "Ebenezer Burgess (Trans.)".to_string()],
            Some("Ancient Sciences"),
            Some(1.0),
            &vec!["Astronomy".to_string(), "Mathematics".to_string(), "History".to_string()],
            Some("Vedic Astronomical Society"),
            Some(1860),
            Some("The quintessential Sanskrit treatise on astronomical calculation, planetary orbits, trigonometry, and solar calendar systems."),
            Some("978-8120806122"),
            None,
        );

        // 3. Arthashastra (Statecraft and Governance)
        let artha_path = sample_books_dir.join("Arthashastra.txt");
        let artha_content = r#"# The Arthashastra (अर्थशास्त्रम्)
By Kautilya (Chanakya)

## Book 1: Concerning Discipline and the Training of the King
Om. Salutations unto Shukra and Brihaspati.
This Arthashastra is compiled as a compendium of almost all the Arthashastras which, in ancient times, were composed by ancient teachers for the acquisition and preservation of the earth.
The king who is trained in the sciences, dedicated to the welfare of his subjects, and righteous in deeds enjoys the earth without challenge.
Discipline is twofold: artificial and inborn. Learning imparts discipline only to him whose mind possesses active faculties of obedience, hearing, retention, understanding, and application.

## Book 2: Duties of Government Superintendents
The sovereign shall construct roads, water reservoirs, market centers, and repositories of books and learning.
Forts shall be defended with mechanical catapults, trenches, and watchful scouts. Revenue shall be derived from agriculture, mining, commerce, and forests without oppressing the common citizens.
"#;
        let _ = fs::write(&artha_path, artha_content);
        let artha_hash = blake3::hash(artha_content.as_bytes()).to_hex().to_string();

        let _ = queries::insert_book(
            &conn,
            &uuid::Uuid::new_v4().to_string(),
            &artha_hash,
            "The Arthashastra (अर्थशास्त्रम्)",
            artha_path.to_str().unwrap(),
            artha_content.len() as i64,
            "TXT",
            2,
            &vec!["Kautilya (Chanakya)".to_string(), "R. Shamasastry (Trans.)".to_string()],
            Some("Ancient Sciences"),
            Some(2.0),
            &vec!["Statecraft".to_string(), "Governance".to_string(), "Economics".to_string()],
            Some("Bangalore Oriental Library"),
            Some(1915),
            Some("Master treatise on political science, economics, diplomacy, and administrative jurisprudence composed in the Mauryan Empire."),
            Some("978-0140446036"),
            None,
        );
    }
}

// Helper method for base64 encoding
impl engine::epub::EpubBook {
    pub fn base64_encode_bytes(data: &[u8]) -> String {
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut result = String::with_capacity((data.len() + 2) / 3 * 4);

        for chunk in data.chunks(3) {
            let b0 = chunk[0];
            let b1 = chunk.get(1).copied().unwrap_or(0);
            let b2 = chunk.get(2).copied().unwrap_or(0);

            let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);

            result.push(CHARSET[((n >> 18) & 63) as usize] as char);
            result.push(CHARSET[((n >> 12) & 63) as usize] as char);

            if chunk.len() > 1 {
                result.push(CHARSET[((n >> 6) & 63) as usize] as char);
            } else {
                result.push('=');
            }

            if chunk.len() > 2 {
                result.push(CHARSET[(n & 63) as usize] as char);
            } else {
                result.push('=');
            }
        }

        result
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("./pustakeum_data"));

            fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
            let db_path = app_data_dir.join("pustakeum_catalog.db");

            let db = Database::init(&db_path).expect("Failed to initialize SQLite database");
            seed_sample_library_if_empty(&db, &app_data_dir);

            // Start background OPDS server on local port 8085
            let opds_db = db.clone();
            tauri::async_runtime::spawn(async move {
                let _ = server::opds::start_opds_server(opds_db, 8085).await;
            });

            app.manage(AppState {
                db,
                storage_dir: app_data_dir,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_library_books,
            commands::search_books,
            commands::pick_files_dialog,
            commands::pick_directory_dialog,
            commands::import_book_file,
            commands::import_directory_recursive,
            commands::reveal_in_explorer,
            commands::update_book_metadata,
            commands::delete_book,
            commands::get_library_stats,
            commands::open_book_content,
            commands::get_cbz_page,
            commands::update_reading_progress,
            commands::search_in_book,
            commands::create_annotation,
            commands::get_book_annotations,
            commands::delete_annotation,
            commands::convert_book_format,
            commands::export_library_catalog,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Pustakeum application");
}

