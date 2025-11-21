//! Basic usage example for the unified UE tools library
//!
//! This example demonstrates how to use the library to:
//! 1. Extract asset paths from a zip file containing pak/utoc files
//! 2. Unpack a single pak file
//! 3. List contents of a.utoc file

use rust_ue_tools::{Unpacker, PakUnpackOptions, UtocListOptions};
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("UE Tools Rust Library - Basic Usage Example");
    println!("==========================================");

    // Create the unpacker instance
    let mut unpacker = Unpacker::new();

    // Example 1: Extract files from an archive (ZIP or RAR)
    println!("\n1. Extracting files from archive...");
    let zip_path = r"C:\Users\rouna\OneDrive\Documents\Marvel_Rivals_Mods\downlaods_test\Magik_s_Winter_skin_Full_Open_Jacket-4708-1-0-1761791345.zip"; // Replace with actual path
    let aes_key = Some("0C263D8C22DCB085894899C3A3796383E9BF9DE0CBFB08C9BF2DEF2E84F29D74");
    
    if Path::new(zip_path).exists() {
        match unpacker.extract_asset_paths_from_archive(zip_path, aes_key, false) {
            Ok(asset_paths) => {
                println!("Found {} asset paths:", asset_paths.len());
                for asset in &asset_paths {
                    println!("  - {}", asset);
                }
            }
            Err(e) => {
                println!("Error extracting from zip: {}", e);
            }
        }
    } else {
        println!("Zip file not found: {}", zip_path);
    }

    // Example 2: Unpack a single pak file
    println!("\n2. Unpacking a pak file...");
    let pak_path = "example_mod.pak"; // Replace with actual path
    let output_dir = "unpacked_pak";
    
    if Path::new(pak_path).exists() {
        let options = PakUnpackOptions::new()
            .with_aes_key(aes_key.unwrap_or_default())
            .with_strip_prefix("../../../")
            .with_force(true)
            .with_quiet(false);
        
        match unpacker.unpack_pak(pak_path, output_dir, &options) {
            Ok(asset_paths) => {
                println!("Unpacked {} files to {}", asset_paths.len(), output_dir);
            }
            Err(e) => {
                println!("Error unpacking pak: {}", e);
            }
        }
    } else {
        println!("Pak file not found: {}", pak_path);
    }

    // Example 3: List contents of a.utoc file
    println!("\n3. Listing.utoc file contents...");
    let utoc_path = "example.utoc"; // Replace with actual path
    
    if Path::new(utoc_path).exists() {
        let options = UtocListOptions::new()
            .with_aes_key(aes_key.unwrap_or_default())
            .with_json_format(false);
        
        match unpacker.list_utoc(utoc_path, &options) {
            Ok(asset_paths) => {
                println!("Found {} assets in.utoc:", asset_paths.len());
                for asset in &asset_paths {
                    println!("  - {}", asset);
                }
            }
            Err(e) => {
                println!("Error listing.utoc: {}", e);
            }
        }
    } else {
        println!("UTOC file not found: {}", utoc_path);
    }

    println!("\nExample completed!");
    Ok(())
}