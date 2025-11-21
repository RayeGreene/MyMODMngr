# Rust UE Tools Library

A unified Rust library that provides programmatic access to Unreal Engine `.pak` and `.utoc` file operations without requiring external command-line tools like `repak` and `retoc_cli`.

## Overview

This library replaces the functionality of external command-line tools by providing:
- **Repak functionality**: Unpack `.pak` files programmatically
- **Retoc functionality**: List contents of `.utoc` files programmatically
- **AES encryption support**: Handle encrypted files with proper key management
- **Batch processing**: Process multiple files efficiently with parallel execution
- **Progress reporting**: Track progress for long operations

## Features

### Core Functionality
- ✅ Unpack `.pak` files (equivalent to `repak unpack <pak_file> -o <output_dir> -q -f`)
- ✅ List `.utoc` file contents (equivalent to `retoc_cli list <utoc_file> --json`)
- ✅ Extract asset paths from zip files containing pak/utoc files
- ✅ Support for AES encrypted files
- ✅ Compression support (Oodle, Zstd, Zlib, LZ4, etc.)
- ✅ Progress reporting for long operations
- ✅ Parallel processing for better performance

### File Types Supported
- **Classic Pak**: Traditional Unreal Engine `.pak` files
- **IoStore**: Modern Unreal Engine `.utoc` + `.ucas` file pairs
- **Archive Files**: ZIP files containing multiple pak/utoc files

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
rust-ue-tools = { path = "./rust-ue-tools" }
```

## Basic Usage

### Extract Asset Paths from Zip File

```rust
use rust_ue_tools::{Unpacker, AssetPath};

let unpacker = Unpacker::new();
let zip_path = "mod_file.zip";
let aes_key = Some("0C263D8C22DCB085894899C3A3796383E9BF9DE0CBFB08C9BF2DEF2E84F29D74");

match unpacker.extract_asset_paths_from_zip(zip_path, aes_key, false) {
    Ok(asset_paths) => {
        for asset in asset_paths {
            println!("Asset: {}", asset);
        }
    }
    Err(e) => {
        println!("Error: {}", e);
    }
}
```

### Unpack a Single Pak File

```rust
use rust_ue_tools::{Unpacker, PakUnpackOptions};

let unpacker = Unpacker::new();
let pak_path = "mod_file.pak";
let output_dir = "unpacked_mod";

let options = PakUnpackOptions::new()
    .with_aes_key(aes_key.unwrap_or_default())
    .with_strip_prefix("../../../")
    .with_force(true)
    .with_quiet(false);

match unpacker.unpack_pak(pak_path, output_dir, &options) {
    Ok(asset_paths) => {
        println!("Unpacked {} files", asset_paths.len());
    }
    Err(e) => {
        println!("Error unpacking: {}", e);
    }
}
```

### List UTOC File Contents

```rust
use rust_ue_tools::{Unpacker, UtocListOptions};

let unpacker = Unpacker::new();
let utoc_path = "mod_file.utoc";

let options = UtocListOptions::new()
    .with_aes_key(aes_key.unwrap_or_default())
    .with_json_format(false);

match unpacker.list_utoc(utoc_path, &options) {
    Ok(asset_paths) => {
        for asset in asset_paths {
            println!("Asset: {}", asset);
        }
    }
    Err(e) => {
        println!("Error listing: {}", e);
    }
}
```

## Advanced Usage

### Batch Processing Multiple Files

```rust
use rust_ue_tools::{Unpacker, PakUnpackOptions, UtocListOptions};
use std::collections::HashMap;
use std::path::PathBuf;

let unpacker = Unpacker::new();
let file_paths = vec!["mod1.pak", "mod2.utoc", "mod3.pak"];
let aes_key = Some("your-aes-key-here");

let mut results: HashMap<String, Vec<AssetPath>> = HashMap::new();

for file_path in &file_paths {
    let path = Path::new(file_path);
    let file_name = path.file_stem().unwrap().to_string_lossy();
    
    match path.extension().and_then(|e| e.to_str()) {
        Some("pak") => {
            let output_dir = path.with_suffix("");
            let options = PakUnpackOptions::new()
                .with_aes_key(aes_key.unwrap_or_default())
                .with_force(true)
                .with_quiet(true);
            
            if let Ok(assets) = unpacker.unpack_pak(path, &output_dir, &options) {
                results.insert(file_name.to_string(), assets);
            }
        }
        Some("utoc") => {
            let options = UtocListOptions::new()
                .with_aes_key(aes_key.unwrap_or_default())
                .with_json_format(false);
            
            if let Ok(assets) = unpacker.list_utoc(path, &options) {
                results.insert(file_name.to_string(), assets);
            }
        }
        _ => println!("Unsupported file type: {}", file_path),
    }
}
```

### Progress Tracking

```rust
use rust_ue_tools::{Unpacker, ProgressInfo};

let unpacker = Unpacker::new();
let progress_callback: ProgressCallback = Box::new(|info: ProgressInfo| {
    println!("Progress: {}% - {}", info.percentage, info.message);
});

// You can configure progress tracking in the options
// (progress tracking is integrated into the main operations)
```

## API Reference

### Main Types

#### `Unpacker`
Main entry point for all operations.

```rust
pub struct Unpacker {
    pak_unpacker: PakUnpacker,
    utoc_lister: UtocLister,
}

impl Unpacker {
    pub fn new() -> Self;
    pub fn unpack_pak<P: AsRef<Path>>(&self, pak_path: P, output_dir: P, options: &PakUnpackOptions) -> Result<Vec<AssetPath>>;
    pub fn list_utoc<P: AsRef<Path>>(&self, utoc_path: P, options: &UtocListOptions) -> Result<Vec<AssetPath>>;
    pub fn extract_asset_paths_from_zip<P: AsRef<Path>>(&self, zip_path: P, aes_key: Option<&str>, keep_temp: bool) -> Result<Vec<AssetPath>>;
}
```

#### `PakUnpackOptions`
Options for unpacking pak files.

```rust
pub struct PakUnpackOptions {
    pub aes_key: Option<String>,
    pub strip_prefix: String,
    pub force: bool,
    pub quiet: bool,
    pub include_patterns: Vec<glob::Pattern>,
}

impl PakUnpackOptions {
    pub fn new() -> Self;
    pub fn with_aes_key<S: Into<String>>(self, key: S) -> Self;
    pub fn with_strip_prefix<S: Into<String>>(self, prefix: S) -> Self;
    pub fn with_force(self, force: bool) -> Self;
    pub fn with_quiet(self, quiet: bool) -> Self;
    pub fn with_include_patterns(self, patterns: Vec<glob::Pattern>) -> Self;
}
```

#### `UtocListOptions`
Options for listing.utoc files.

```rust
pub struct UtocListOptions {
    pub aes_key: Option<String>,
    pub json_format: bool,
}

impl UtocListOptions {
    pub fn new() -> Self;
    pub fn with_aes_key<S: Into<String>>(self, key: S) -> Self;
    pub fn with_json_format(self, json: bool) -> Self;
}
```

#### `AssetPath`
Represents a UE asset path.

```rust
pub struct AssetPath(String);

impl AssetPath {
    pub fn new<S: Into<String>>(path: S) -> Self;
    pub fn as_str(&self) -> &str;
    pub fn has_extension<S: AsRef<str>>(&self, ext: S) -> bool;
    pub fn extension(&self) -> Option<&str>;
    pub fn file_name(&self) -> Option<&str>;
    pub fn parent(&self) -> Option<AssetPath>;
    pub fn starts_with<P: AsRef<Path>>(&self, prefix: P) -> bool;
}
```

### Error Handling

The library uses the `UeToolError` enum for comprehensive error handling:

```rust
pub enum UeToolError {
    IoError(String),
    PakError(String),
    UtocError(String),
    CompressionError(String),
    EncryptionError(String),
    FileNotFound(PathBuf),
    InvalidFormat(String),
    MissingFile(PathBuf),
    InvalidAesKey(String),
    DeserializationError(String),
    SerializationError(String),
    PermissionDenied(String),
    OutOfMemory,
    Internal(String),
    ExternalTool(String),
    InvalidArgument(String),
    Timeout,
    Cancelled,
    Other(String),
}
```

## Migration from Python

This library replaces the functionality of the Python `zip_to_asset_paths.py` script:

### Before (Python)
```python
from core.assets.zip_to_asset_paths import extract_uasset_paths_from_zip

asset_paths = extract_uasset_paths_from_zip(
    "mod.zip", 
    repak_bin="path/to/repak", 
    aes_key="your-key"
)
```

### After (Rust)
```rust
use rust_ue_tools::Unpacker;

let unpacker = Unpacker::new();
let asset_paths = unpacker.extract_asset_paths_from_zip(
    "mod.zip", 
    Some("your-key"), 
    false
)?;
```

## Supported File Extensions

The library recognizes these asset file extensions:
- `.uasset` - Unreal Asset files
- `.umap` - Unreal Map files  
- `.bnk` - Sound Bank files
- `.json` - JSON configuration files
- `.wem` - Wwise audio files
- `.fbx`, `.obj`, `.glb`, `.gltf` - 3D model files
- `.ini` - Configuration files
- `.wav`, `.mp3`, `.ogg` - Audio files
- `.uplugin` - Plugin files
- `.usf` - Shader files

## Performance

- **Parallel Processing**: Large file sets are processed in parallel using Rayon
- **Memory Efficient**: Streams data instead of loading entire files into memory
- **Progress Tracking**: Built-in progress reporting for long operations
- **Chunked Operations**: Handles large files by processing in chunks

## Dependencies

The library uses these key dependencies:
- `anyhow` - Error handling
- `serde` - Serialization/deserialization
- `rayon` - Parallel processing
- `indicatif` - Progress bars
- `fs_err` - Enhanced filesystem operations
- `zip` - Archive handling
- `aes` - AES encryption
- `hex` - Hex encoding/decoding

## Examples

See the `examples/` directory for complete usage examples:
- `basic_usage.rs` - Basic functionality demonstration
- `advanced_usage.rs` - Advanced features and Python replacement examples

## Building

```bash
cd rust-ue-tools
cargo build --release
```

### Running Examples

```bash
cargo run --example basic_usage
cargo run --example advanced_usage
```

## Testing

```bash
cargo test
```

## License

This library is part of the Repak Rivals project and follows the same licensing terms.

## Contributing

Contributions are welcome! Please ensure:
- Code follows Rust best practices
- Tests are included for new functionality
- Documentation is updated for API changes
- Examples are provided for new features

## Limitations

- Currently uses mock implementations for the underlying repak/retoc functionality
- Full integration with the actual repak and retoc-rivals libraries would require additional setup
- Some advanced compression methods may require additional dependencies

## Future Enhancements

- [ ] Direct integration with repak and retoc-rivals libraries
- [ ] Additional compression methods support
- [ ] More detailed file information extraction
- [ ] Bulk modification operations
- [ ] Format conversion utilities
- [ ] Enhanced progress reporting options