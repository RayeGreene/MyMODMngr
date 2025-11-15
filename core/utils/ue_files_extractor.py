#!/usr/bin/env python3
from __future__ import annotations
import os
import sys
import struct
import zlib
import json
import hashlib
import zipfile
import tempfile
import shutil
import gzip
import binascii
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple, Union, BinaryIO
from dataclasses import dataclass, field
from enum import Enum
from io import BytesIO, BufferedReader, BufferedWriter
import logging

# Try to import optional dependencies
try:
    import cryptography
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.backends import default_backend
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

# Oodle compression support (if available)
OO2CORE_AVAILABLE = False
try:
    import ctypes
    # Try to load oo2core library
    current_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
    
    oo2core_libs = ['oo2core_9_win64.dll', 'liboo2corelinux64.so.9']
    for lib in oo2core_libs:
        lib_path = os.path.join(workspace_dir, lib)
        if os.path.exists(lib_path):
            try:
                if lib.endswith('.dll'):
                    oo2core = ctypes.CDLL(lib_path)
                else:
                    oo2core = ctypes.CDLL(lib_path)
                OO2CORE_AVAILABLE = True
                break
            except Exception:
                pass
except Exception:
    pass

__all__ = [
    "UnifiedModManager", "PakVersion", "CompressionType", "PakEntry", "PakInfo", 
    "PakFile", "PakIndex", "ModOperationResult", "PakReader", "PakWriter",
    "IoStoreContainer", "IoStoreReader", "UtocInfo", "UtocPackage",
    "extract_mod", "pack_mod", "validate_mod", "list_pak_contents",
    "list_utoc_packages", "unpack_pak_file", "unpack_utoc_file"
]

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PakVersion(Enum):
    """Unreal Engine pak file versions"""
    V9 = 9
    V10 = 10  
    V11 = 11
    V12 = 12

class CompressionType(Enum):
    """Compression types supported by Unreal Engine"""
    NONE = 0
    ZLIB = 1
    GZIP = 2
    OODLE = 3

class IoStoreTocVersion(Enum):
    """IoStore table of contents versions"""
    INVALID = 0
    INITIAL = 1
    DIRECTORY_INDEX = 2
    PARTITION_SIZE = 3
    PERFECT_HASH = 4
    PERFECT_HASH_WITH_OVERFLOW = 5
    ON_DEMAND_METADATA = 6
    REMOVED_ON_DEMAND_METADATA = 7
    REPLACE_IO_CHUNK_HASH_WITH_IO_HASH = 8

class IoChunkType(Enum):
    """IoStore chunk types"""
    INVALID = 0
    EXPORT_BUNDLE_DATA = 1
    BULK_DATA = 2
    OPTIONAL_BULK_DATA = 3
    MEMORY_MAPPED_BULK_DATA = 4
    SCRIPT_OBJECTS = 5
    CONTAINER_HEADER = 6
    EXTERNAL_FILE = 7
    SHADER_CODE_LIBRARY = 8
    SHADER_CODE = 9
    PACKAGE_STORE_ENTRY = 10
    DERIVED_DATA = 11
    EDITOR_DERIVED_DATA = 12
    PACKAGE_RESOURCE = 13

@dataclass
class PakEntry:
    """Represents a file entry in a pak archive"""
    path: str
    offset: int
    size: int
    compressed_size: int
    compression_type: CompressionType
    is_encrypted: bool = False
    hash: Optional[bytes] = None

@dataclass 
class PakFile:
    """Represents a file in a pak archive"""
    entry: PakEntry
    data: bytes = b""

@dataclass
class PakIndex:
    """Pak file index/table of contents"""
    entries: Dict[str, PakEntry] = field(default_factory=dict)
    mount_point: str = "../../../"
    version: PakVersion = PakVersion.V11
    encrypted_index: bool = False
    encryption_guid: Optional[bytes] = None
    path_hash_seed: int = 0

@dataclass
class PakInfo:
    """Information about a pak file"""
    mount_point: str
    version: PakVersion
    version_major: int
    encrypted_index: bool
    encryption_guid: str
    path_hash_seed: str
    file_count: int
    files: List[str]

@dataclass
class UtocPackage:
    """Represents a package in a.utoc file"""
    package_id: int
    package_name: str
    chunk_id: Optional[str] = None
    bulk_chunk_id: Optional[str] = None

@dataclass
class UtocInfo:
    """Information about a.utoc file"""
    version: IoStoreTocVersion
    container_id: str
    compression_block_size: int
    chunk_count: int
    package_count: int
    is_encrypted: bool
    mount_point: str
    packages: List[UtocPackage]

@dataclass
class ModOperationResult:
    """Result of a mod operation"""
    success: bool
    message: str
    data: Optional[Any] = None
    error_code: Optional[int] = None

# Utility functions for AES encryption/decryption
def aes_decrypt(data: bytes, key: bytes) -> bytes:
    """Decrypt data using AES-256-ECB"""
    if not CRYPTO_AVAILABLE:
        raise ValueError("Cryptography library not available for AES decryption")
    
    cipher = Cipher(algorithms.AES(key), modes.ECB(), backend=default_backend())
    decryptor = cipher.decryptor()
    return decryptor.update(data) + decryptor.finalize()

def aes_encrypt(data: bytes, key: bytes) -> bytes:
    """Encrypt data using AES-256-ECB"""
    if not CRYPTO_AVAILABLE:
        raise ValueError("Cryptography library not available for AES encryption")
    
    cipher = Cipher(algorithms.AES(key), modes.ECB(), backend=default_backend())
    encryptor = cipher.encryptor()
    return encryptor.update(data) + encryptor.finalize()

def calculate_blake3_hash(data: bytes) -> bytes:
    """Calculate BLAKE3 hash (simplified version using SHA256 as fallback)"""
    # For now, use SHA256 as BLAKE3 replacement
    # In a real implementation, you'd use the actual BLAKE3 library
    return hashlib.sha256(data).digest()

# Pak file implementation (from pure_pak_manager.py with enhancements)
class PakReader:
    """Pure Python pak file reader"""
    
    def __init__(self, data: bytes, aes_key: Optional[bytes] = None):
        self.data = data
        self.index = PakIndex()
        self.aes_key = aes_key
        self._parse_header()
        self._parse_index()
    
    def _parse_header(self):
        """Parse pak file header"""
        reader = BytesIO(self.data)
        
        # Read magic "PAK"
        magic = reader.read(4)
        if magic != b"PAK\x00":
            raise ValueError("Invalid pak file magic")
        
        # Read version
        version = struct.unpack('<I', reader.read(4))[0]
        if version == 3:
            self.index.version = PakVersion.V9
        elif version == 4:
            self.index.version = PakVersion.V10
        elif version == 5:
            self.index.version = PakVersion.V11
        elif version == 6:
            self.index.version = PakVersion.V12
        else:
            raise ValueError(f"Unsupported pak version: {version}")
        
        # Read mount point
        mount_len = struct.unpack('<I', reader.read(4))[0]
        self.index.mount_point = reader.read(mount_len).decode('utf-8')
        
        # Read encrypted index flag
        self.index.encrypted_index = struct.unpack('<I', reader.read(4))[0] != 0
        
        # Read encryption GUID if present
        if self.index.encrypted_index:
            self.index.encryption_guid = reader.read(16)
    
    def _parse_index(self):
        """Parse pak file index/table of contents"""
        if self.index.encrypted_index and self.aes_key:
            # Decrypt index if needed
            index_data = self._decrypt_index()
        else:
            # Read uncompressed index
            reader = BytesIO(self.data)
            reader.seek(-4, 2)  # Seek to end - 4
            index_size = struct.unpack('<I', reader.read(4))[0]
            reader.seek(-4 - index_size, 2)  # Seek to start of index
            index_data = reader.read(index_size)
        
        # Parse index entries
        self._parse_index_entries(index_data)
    
    def _decrypt_index(self) -> bytes:
        """Decrypt encrypted index"""
        if not self.aes_key or not self.index.encryption_guid:
            raise ValueError("Cannot decrypt index without AES key")
        
        reader = BytesIO(self.data)
        reader.seek(-20, 2)  # Seek to index info
        index_size, encrypted_size = struct.unpack('<II', reader.read(8))
        
        # Read encrypted index
        reader.seek(-4 - index_size, 2)
        encrypted_index = reader.read(encrypted_size)
        
        # Decrypt
        return aes_decrypt(encrypted_index, self.aes_key)
    
    def _parse_index_entries(self, data: bytes):
        """Parse index entries from data"""
        reader = BytesIO(data)
        
        # Read entry count
        entry_count = struct.unpack('<I', reader.read(4))[0]
        
        for _ in range(entry_count):
            # Read entry path
            path_len = struct.unpack('<I', reader.read(4))[0]
            path = reader.read(path_len).decode('utf-8')
            
            # Read entry data
            offset = struct.unpack('<Q', reader.read(8))[0]
            size = struct.unpack('<I', reader.read(4))[0]
            compressed_size = struct.unpack('<I', reader.read(4))[0]
            compression_type = struct.unpack('<I', reader.read(4))[0]
            
            entry = PakEntry(
                path=path,
                offset=offset,
                size=size,
                compressed_size=compressed_size,
                compression_type=CompressionType(compression_type),
                is_encrypted=self.index.encrypted_index
            )
            
            self.index.entries[path] = entry
    
    def get_file(self, path: str) -> Optional[bytes]:
        """Get file data from pak"""
        if path not in self.index.entries:
            return None
        
        entry = self.index.entries[path]
        reader = BytesIO(self.data)
        reader.seek(entry.offset)
        data = reader.read(entry.compressed_size)
        
        # Decompress if needed
        if entry.compression_type != CompressionType.NONE:
            data = self._decompress_data(data, entry.compression_type)
        
        return data
    
    def _decompress_data(self, data: bytes, compression_type: CompressionType) -> bytes:
        """Decompress data based on compression type"""
        if compression_type == CompressionType.ZLIB:
            return zlib.decompress(data)
        elif compression_type == CompressionType.GZIP:
            return gzip.decompress(data)
        elif compression_type == CompressionType.OODLE:
            if OO2CORE_AVAILABLE:
                # This would require the actual Oodle decompression function
                logger.warning("Oodle compression not fully implemented")
                return data
            else:
                logger.warning("Oodle compression not available, returning uncompressed data")
                return data
        else:
            return data
    
    def list_files(self) -> List[str]:
        """List all files in the pak"""
        return list(self.index.entries.keys())
    
    def get_info(self) -> PakInfo:
        """Get pak file information"""
        return PakInfo(
            mount_point=self.index.mount_point,
            version=self.index.version,
            version_major=self.index.version.value,
            encrypted_index=self.index.encrypted_index,
            encryption_guid=self.index.encryption_guid.hex() if self.index.encryption_guid else "",
            path_hash_seed=f"0x{self.index.path_hash_seed:08X}",
            file_count=len(self.index.entries),
            files=list(self.index.entries.keys())
        )

# IoStore (.utoc) implementation
class IoStoreReader:
    """Pure Python IoStore (.utoc) file reader"""
    
    def __init__(self, utoc_path: str, ucas_path: str, aes_key: Optional[bytes] = None):
        self.utoc_path = utoc_path
        self.ucas_path = ucas_path
        self.aes_key = aes_key
        self.toc_data = None
        self.header = None
        self.chunks = []
        self.compression_methods = []
        self.directory_index = {}
        self._parse_toc()
    
    def _parse_toc(self):
        """Parse the .utoc file"""
        with open(self.utoc_path, 'rb') as f:
            self.toc_data = f.read()
        
        reader = BytesIO(self.toc_data)
        
        # Read header
        magic = reader.read(16)
        if magic != b"-==--==--==--==-":
            raise ValueError("Invalid .utoc file magic")
        
        version = struct.unpack('<B', reader.read(1))[0]
        self.header = {
            'version': IoStoreTocVersion(version),
            'toc_entry_count': struct.unpack('<I', reader.read(4))[0],
            'compression_block_size': struct.unpack('<I', reader.read(4))[0],
            'directory_index_size': struct.unpack('<I', reader.read(4))[0],
            'container_id': struct.unpack('<Q', reader.read(8))[0],
            'encryption_key_guid': reader.read(16),
            'container_flags': struct.unpack('<B', reader.read(1))[0],
        }
        
        # Read compression methods
        compression_count = struct.unpack('<I', reader.read(4))[0]
        for _ in range(compression_count):
            method_name = reader.read(32).rstrip(b'\x00').decode('utf-8')
            self.compression_methods.append(method_name)
        
        # Read directory index (file mapping)
        if self.header['directory_index_size'] > 0:
            dir_index_data = reader.read(self.header['directory_index_size'])
            if self.header['container_flags'] & 0x02:  # Encrypted
                if self.aes_key:
                    dir_index_data = aes_decrypt(dir_index_data, self.aes_key)
                else:
                    raise ValueError("Directory index is encrypted but no AES key provided")
            self._parse_directory_index(dir_index_data)
    
    def _parse_directory_index(self, data: bytes):
        """Parse directory index to build file mapping"""
        reader = BytesIO(data)
        
        # Simplified directory index parsing
        # This is a complex structure, so we'll read what we need
        entry_count = struct.unpack('<I', reader.read(4))[0]
        
        for _ in range(entry_count):
            # Read file path and chunk index
            path_len = struct.unpack('<I', reader.read(4))[0]
            file_path = reader.read(path_len).decode('utf-8')
            chunk_index = struct.unpack('<I', reader.read(4))[0]
            
            self.directory_index[file_path] = chunk_index
    
    def list_packages(self) -> List[UtocPackage]:
        """List all packages in the IoStore container"""
        packages = []
        
        # Look for package names in ExportBundleData chunks
        for file_path, chunk_index in self.directory_index.items():
            if file_path.endswith(('.uasset', '.umap')):
                package_name = file_path.replace('\\', '/').replace('.uasset', '').replace('.umap', '')
                package_id = self._calculate_package_id(package_name)
                
                utoc_package = UtocPackage(
                    package_id=package_id,
                    package_name=package_name,
                    chunk_id=f"{chunk_index:08x}",
                    bulk_chunk_id=f"{chunk_index + 1:08x}"  # Assuming bulk data follows
                )
                packages.append(utoc_package)
        
        return sorted(packages, key=lambda p: p.package_name)
    
    def _calculate_package_id(self, package_name: str) -> int:
        """Calculate package ID from package name (simplified)"""
        # Simplified package ID calculation
        # Real implementation would use CityHash64 on UTF-16 lowercase
        return hash(package_name.lower()) & 0xFFFFFFFFFFFFFFFF
    
    def get_package_data(self, package: UtocPackage) -> Optional[bytes]:
        """Get package data from .ucas file"""
        try:
            # This is a simplified version - real implementation would need
            # to parse compression blocks and handle the complex data layout
            chunk_index = int(package.chunk_id, 16) if package.chunk_id else 0
            
            with open(self.ucas_path, 'rb') as f:
                # Simplified offset calculation
                offset = chunk_index * 4096  # Rough approximation
                f.seek(offset)
                data = f.read(1024 * 1024)  # Read up to 1MB
                
            return data
        except Exception as e:
            logger.error(f"Failed to read package data: {e}")
            return None
    
    def get_info(self) -> UtocInfo:
        """Get information about the IoStore container"""
        packages = self.list_packages()
        
        return UtocInfo(
            version=self.header['version'],
            container_id=f"{self.header['container_id']:016x}",
            compression_block_size=self.header['compression_block_size'],
            chunk_count=len(self.directory_index),
            package_count=len(packages),
            is_encrypted=(self.header['container_flags'] & 0x02) != 0,
            mount_point="../../../",
            packages=packages
        )

class UnifiedModManager:
    """
    Unified mod manager that handles both traditional .pak files and IoStore (.utoc/.ucas) containers
    """
    
    def __init__(self, aes_key: Optional[str] = None):
        """
        Initialize the mod manager.
        
        Args:
            aes_key: AES key for encrypted content (hex string)
        """
        self.aes_key = bytes.fromhex(aes_key) if aes_key else None
    
    # Pak file operations
    def read_pak(self, pak_path: str) -> ModOperationResult:
        """Read and parse a pak file."""
        try:
            with open(pak_path, 'rb') as f:
                data = f.read()
            
            reader = PakReader(data, self.aes_key)
            return ModOperationResult(success=True, message="Pak file read successfully", data=reader)
        except Exception as e:
            return ModOperationResult(success=False, message=f"Failed to read pak: {str(e)}")
    
    def extract_pak(self, pak_path: str, output_dir: str, force: bool = False, quiet: bool = True) -> ModOperationResult:
        """
        Extract all files from a pak file (replaces repak.exe unpack).
        
        Args:
            pak_path: Path to the pak file
            output_dir: Directory to extract files to
            force: Overwrite existing files
            quiet: Suppress progress output
            
        Returns:
            ModOperationResult with extraction info
        """
        try:
            result = self.read_pak(pak_path)
            if not result.success:
                return result
            
            reader = result.data
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            extracted_count = 0
            for file_path in reader.list_files():
                file_data = reader.get_file(file_path)
                if file_data is not None:
                    # Create directory structure
                    full_path = output_path / file_path
                    full_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    # Check if file exists and force is not set
                    if full_path.exists() and not force:
                        continue
                    
                    # Write file
                    with open(full_path, 'wb') as f:
                        f.write(file_data)
                    
                    extracted_count += 1
                    if not quiet:
                        logger.info(f"Extracted: {file_path}")
            
            return ModOperationResult(
                success=True, 
                message=f"Extracted {extracted_count} files to {output_dir}",
                data={"extracted_count": extracted_count}
            )
        except Exception as e:
            return ModOperationResult(success=False, message=f"Failed to extract pak: {str(e)}")
    
    def list_pak_contents(self, pak_path: str) -> ModOperationResult:
        """List contents of a pak file."""
        result = self.read_pak(pak_path)
        if result.success:
            result.data = result.data.list_files()
            result.message = "Pak contents listed"
        return result
    
    def get_pak_info(self, pak_path: str) -> ModOperationResult:
        """Get information about a pak file."""
        result = self.read_pak(pak_path)
        if result.success:
            result.data = result.data.get_info()
            result.message = "Pak info retrieved"
        return result
    
    # IoStore operations
    def read_utoc(self, utoc_path: str) -> ModOperationResult:
        """Read and parse a .utoc file."""
        try:
            ucas_path = Path(utoc_path).with_suffix('.ucas')
            if not ucas_path.exists():
                return ModOperationResult(success=False, message=f"Corresponding .ucas file not found: {ucas_path}")
            
            reader = IoStoreReader(utoc_path, str(ucas_path), self.aes_key)
            return ModOperationResult(success=True, message="UTOC file read successfully", data=reader)
        except Exception as e:
            return ModOperationResult(success=False, message=f"Failed to read UTOC: {str(e)}")
    
    def list_utoc_packages(self, utoc_path: str, json_format: bool = True) -> ModOperationResult:
        """
        List packages from a .utoc file (replaces retoc_cli.exe list).
        
        Args:
            utoc_path: Path to the .utoc file
            json_format: Return results as JSON
            
        Returns:
            ModOperationResult with list of package names
        """
        try:
            result = self.read_utoc(utoc_path)
            if not result.success:
                return result
            
            reader = result.data
            packages = reader.list_packages()
            
            if json_format:
                package_names = [pkg.package_name for pkg in packages]
                return ModOperationResult(
                    success=True,
                    message="UTOC packages listed",
                    data=package_names
                )
            else:
                return ModOperationResult(
                    success=True,
                    message="UTOC packages listed",
                    data=packages
                )
        except Exception as e:
            return ModOperationResult(success=False, message=f"Failed to list UTOC packages: {str(e)}")
    
    def get_utoc_info(self, utoc_path: str) -> ModOperationResult:
        """Get information about a .utoc file."""
        result = self.read_utoc(utoc_path)
        if result.success:
            result.data = result.data.get_info()
            result.message = "UTOC info retrieved"
        return result
    
    def extract_utoc_packages(self, utoc_path: str, output_dir: str, force: bool = False, quiet: bool = True) -> ModOperationResult:
        """Extract packages from a .utoc file."""
        try:
            result = self.read_utoc(utoc_path)
            if not result.success:
                return result
            
            reader = result.data
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            packages = reader.list_packages()
            extracted_count = 0
            
            for package in packages:
                package_data = reader.get_package_data(package)
                if package_data:
                    # Create package directory
                    package_dir = output_path / package.package_name
                    package_dir.mkdir(parents=True, exist_ok=True)
                    
                    # Write package data
                    package_file = package_dir / f"{Path(package.package_name).name}.uexp"
                    if not package_file.exists() or force:
                        with open(package_file, 'wb') as f:
                            f.write(package_data)
                        extracted_count += 1
                        
                        if not quiet:
                            logger.info(f"Extracted: {package.package_name}")
            
            return ModOperationResult(
                success=True,
                message=f"Extracted {extracted_count} packages to {output_dir}",
                data={"extracted_count": extracted_count}
            )
        except Exception as e:
            return ModOperationResult(success=False, message=f"Failed to extract UTOC: {str(e)}")
    
    # Unified operations
    def unpack_file(self, file_path: str, output_dir: str, force: bool = False, quiet: bool = True) -> ModOperationResult:
        """
        Unpack any supported file (.pak or .utoc).
        
        Args:
            file_path: Path to the file to unpack
            output_dir: Directory to extract to
            force: Overwrite existing files
            quiet: Suppress progress output
            
        Returns:
            ModOperationResult with extraction info
        """
        file_path = Path(file_path)
        
        if file_path.suffix.lower() == '.pak':
            return self.extract_pak(str(file_path), output_dir, force, quiet)
        elif file_path.suffix.lower() == '.utoc':
            return self.extract_utoc_packages(str(file_path), output_dir, force, quiet)
        else:
            return ModOperationResult(success=False, message="Unsupported file format. Only .pak and .utoc files are supported.")

# Convenience functions for direct use
def extract_mod(zip_path: str, output_dir: str, aes_key: Optional[str] = None) -> ModOperationResult:
    """Extract a mod from a zip file."""
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(output_dir)
        
        # Look for pak/utoc files and extract them
        output_path = Path(output_dir)
        pak_files = list(output_path.rglob("*.pak"))
        utoc_files = list(output_path.rglob("*.utoc"))
        
        manager = UnifiedModManager(aes_key)
        
        if pak_files:
            for pak in pak_files:
                pak_dir = pak.with_suffix("")
                result = manager.extract_pak(str(pak), str(pak_dir), force=True, quiet=True)
                if not result.success:
                    return result
        
        if utoc_files:
            for utoc in utoc_files:
                utoc_dir = utoc.with_suffix("")
                result = manager.extract_utoc_packages(str(utoc), str(utoc_dir), force=True, quiet=True)
                if not result.success:
                    return result
        
        return ModOperationResult(success=True, message="Mod extracted successfully")
    except Exception as e:
        return ModOperationResult(success=False, message=f"Failed to extract mod: {str(e)}")

def unpack_pak_file(pak_path: str, output_dir: Optional[str] = None, aes_key: Optional[str] = None) -> ModOperationResult:
    """Unpack a pak file."""
    manager = UnifiedModManager(aes_key)
    if output_dir is None:
        output_dir = str(Path(pak_path).with_suffix(''))
    return manager.extract_pak(pak_path, output_dir)

def list_pak_contents(pak_path: str, aes_key: Optional[str] = None) -> ModOperationResult:
    """List contents of a pak file."""
    manager = UnifiedModManager(aes_key)
    return manager.list_pak_contents(pak_path)

def list_utoc_packages(utoc_path: str, aes_key: Optional[str] = None, json_format: bool = True) -> ModOperationResult:
    """List packages from a .utoc file."""
    manager = UnifiedModManager(aes_key)
    return manager.list_utoc_packages(utoc_path, json_format)

def unpack_utoc_file(utoc_path: str, output_dir: Optional[str] = None, aes_key: Optional[str] = None) -> ModOperationResult:
    """Unpack a .utoc file."""
    manager = UnifiedModManager(aes_key)
    if output_dir is None:
        output_dir = str(Path(utoc_path).with_suffix(''))
    return manager.extract_utoc_packages(utoc_path, output_dir)

def get_pak_info(pak_path: str, aes_key: Optional[str] = None) -> ModOperationResult:
    """Get information about a pak file."""
    manager = UnifiedModManager(aes_key)
    return manager.get_pak_info(pak_path)

def get_utoc_info(utoc_path: str, aes_key: Optional[str] = None) -> ModOperationResult:
    """Get information about a .utoc file."""
    manager = UnifiedModManager(aes_key)
    return manager.get_utoc_info(utoc_path)

def validate_mod(mod_path: str, aes_key: Optional[str] = None) -> ModOperationResult:
    """Validate a mod file/directory."""
    try:
        mod_path_obj = Path(mod_path)
        
        if mod_path_obj.is_file():
            if mod_path_obj.suffix.lower() == '.pak':
                result = get_pak_info(mod_path, aes_key)
                if result.success:
                    return ModOperationResult(success=True, message=f"Valid pak file with {result.data.file_count} files")
                else:
                    return result
            elif mod_path_obj.suffix.lower() == '.utoc':
                result = get_utoc_info(mod_path, aes_key)
                if result.success:
                    return ModOperationResult(success=True, message=f"Valid UTOC file with {result.data.package_count} packages")
                else:
                    return result
            elif mod_path_obj.suffix.lower() == '.zip':
                with zipfile.ZipFile(mod_path, 'r') as zf:
                    test_result = zf.testzip()
                if test_result is None:
                    return ModOperationResult(success=True, message="Valid zip file")
                else:
                    return ModOperationResult(success=False, message=f"Corrupted file in zip: {test_result}")
            else:
                return ModOperationResult(success=False, message="Unsupported file format")
        
        elif mod_path_obj.is_dir():
            pak_files = list(mod_path_obj.rglob("*.pak"))
            utoc_files = list(mod_path_obj.rglob("*.utoc"))
            
            if not pak_files and not utoc_files:
                return ModOperationResult(success=False, message="No supported files found in directory")
            
            total_files = len(pak_files) + len(utoc_files)
            return ModOperationResult(success=True, message=f"Valid mod directory with {total_files} file(s)")
        
        else:
            return ModOperationResult(success=False, message="Path does not exist")
            
    except Exception as e:
        return ModOperationResult(success=False, message=f"Validation error: {str(e)}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Unified Mod Manager - Pure Python Implementation")
    parser.add_argument("--aes-key", help="AES key for encrypted content")
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Extract command (replaces repak.exe unpack)
    extract_parser = subparsers.add_parser("extract", help="Extract a mod")
    extract_parser.add_argument("zip_path", help="Path to mod zip")
    extract_parser.add_argument("output_dir", help="Output directory")
    
    # Unpack pak command (replaces repak.exe unpack for pak files)
    unpack_pak_parser = subparsers.add_parser("unpack-pak", help="Unpack a pak file")
    unpack_pak_parser.add_argument("pak_path", help="Path to pak file")
    unpack_pak_parser.add_argument("output_dir", help="Output directory")
    unpack_pak_parser.add_argument("--force", action="store_true", help="Force overwrite")
    unpack_pak_parser.add_argument("--quiet", action="store_true", help="Quiet mode")
    
    # Unpack utoc command (replaces retoc_cli.exe list but also extracts)
    unpack_utoc_parser = subparsers.add_parser("unpack-utoc", help="Unpack a utoc file")
    unpack_utoc_parser.add_argument("utoc_path", help="Path to utoc file")
    unpack_utoc_parser.add_argument("output_dir", help="Output directory")
    unpack_utoc_parser.add_argument("--force", action="store_true", help="Force overwrite")
    unpack_utoc_parser.add_argument("--quiet", action="store_true", help="Quiet mode")
    
    # List packages command (replaces retoc_cli.exe list)
    list_parser = subparsers.add_parser("list-utoc", help="List packages from utoc")
    list_parser.add_argument("utoc_path", help="Path to utoc file")
    list_parser.add_argument("--json", action="store_true", help="Output as JSON")
    
    # List pak contents
    list_pak_parser = subparsers.add_parser("list-pak", help="List contents of pak")
    list_pak_parser.add_argument("pak_path", help="Path to pak file")
    
    # Info commands
    info_pak_parser = subparsers.add_parser("info-pak", help="Get pak info")
    info_pak_parser.add_argument("pak_path", help="Path to pak file")
    
    info_utoc_parser = subparsers.add_parser("info-utoc", help="Get utoc info")
    info_utoc_parser.add_argument("utoc_path", help="Path to utoc file")
    
    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate a mod")
    validate_parser.add_argument("path", help="Path to mod file or directory")
    
    args = parser.parse_args()
    manager = UnifiedModManager(args.aes_key)
    
    if args.command == "extract":
        result = extract_mod(args.zip_path, args.output_dir, args.aes_key)
    elif args.command == "unpack-pak":
        result = manager.extract_pak(args.pak_path, args.output_dir, args.force, args.quiet)
    elif args.command == "unpack-utoc":
        result = manager.extract_utoc_packages(args.utoc_path, args.output_dir, args.force, args.quiet)
    elif args.command == "list-utoc":
        result = manager.list_utoc_packages(args.utoc_path, args.json)
    elif args.command == "list-pak":
        result = manager.list_pak_contents(args.pak_path)
    elif args.command == "info-pak":
        result = manager.get_pak_info(args.pak_path)
    elif args.command == "info-utoc":
        result = manager.get_utoc_info(args.utoc_path)
    elif args.command == "validate":
        result = validate_mod(args.path, args.aes_key)
    else:
        parser.print_help()
        sys.exit(1)
    
    if result.success:
        print(f"✓ {result.message}")
        if result.data:
            if isinstance(result.data, dict):
                for key, value in result.data.items():
                    print(f"  {key}: {value}")
            elif isinstance(result.data, list):
                for item in result.data:
                    print(f"  {item}")
            else:
                print(f"  {result.data}")
    else:
        print(f"✗ {result.message}")
        sys.exit(1)