## 🎉 Version 0.2.2 - Patch Notes

### 🔧 PAK Handling & Archive Extraction Improvements

### Enhanced PAK File Processing

- **Fallback PAK Scanning**: Added reliable fallback mechanism when asset map extraction fails
- **Unified File Organization**: Merged .pak/.utoc/.ucas files into unified entries for better mod management
- **Improved Asset Processing**: Enhanced memory access patterns for faster PAK file operations

### Archive Extraction Enhancements

- **7z Archive Support**: Enhanced 7z archive support with binary extraction fallback
- **Robust Error Handling**: Better fallback behavior when primary extraction methods fail
- **Debug Logging**: Added comprehensive debug logging for asset extraction and processing

### Mod Deletion Workflow

- **Proper Deactivation Sequence**: Improved mod deletion workflow with correct deactivation order
- **Clean Removal Process**: Ensures complete mod cleanup with proper asset unregistration
- **Enhanced User Experience**: More reliable and predictable mod removal process

### Reliability Improvements

- **Better Error Recovery**: Enhanced fallback mechanisms throughout the mod management pipeline
- **Performance Optimizations**: Improved processing speeds for large mod collections
- **Debug Capabilities**: Added detailed logging for troubleshooting complex mod scenarios

## 📥 Installation

### Quick Start

1. Download `<INSTALLER_FILENAME>` from the downloads table below
2. Run the installer
3. Launch RivalNxt from your Start Menu
4. Configure in Settings:
   - **Local downloads directory** → Select the folder where your Marvel Rivals mods are downloaded/saved (create anywhere or use existing folder)
   - **Nexus Personal API Key** → Get your [API key](https://next.nexusmods.com/settings/api-keys) (scroll all the way down) and paste it into RivalNxt

> 📖 **Need more help?** See the [full installation guide](https://github.com/Rounak77382/RivalNxt?tab=readme-ov-file#-installation) for detailed setup instructions.

## 📥 Downloads

| File                                  | Platform    | Checksum                 |
| ------------------------------------- | ----------- | ------------------------ |
| [<INSTALLER_FILENAME>](<INSTALLER_URL>) | x64 Windows | [checksum](<CHECKSUM_URL>) |

> To verify the download on Windows, run `certutil -hashfile <filename> SHA256` and compare it with the value in the `.sha256` file.

---

**Questions or issues?** Please report bugs or feature requests via [GitHub Issues](https://github.com/Rounak77382/RivalNxt/issues).
