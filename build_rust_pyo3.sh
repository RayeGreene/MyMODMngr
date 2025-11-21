#!/bin/bash

# Build script for Rust UE Tools with PyO3 bindings
set -e

echo "Building Rust UE Tools with PyO3 bindings..."

cd src-tauri/src/rust-ue-tools

# Build with PyO3 feature for Python bindings
echo "Building debug version with PyO3..."
cargo build --features pyo3 --lib

echo "Building release version with PyO3..."
cargo build --release --features pyo3 --lib

# Create wheels directory
mkdir -p target/wheels

# Install maturin for building Python wheels
echo "Installing maturin..."
pip install maturin

# Build Python wheel
echo "Building Python wheel..."
maturin build --features pyo3 --release --out target/wheels

# Install the wheel in development mode
echo "Installing wheel in development mode..."
pip install --force-reinstall target/wheels/*.whl

echo "Build complete! Python bindings are ready."
echo "You can now use: from rust_ue_tools_pyo3 import PyUnpacker"