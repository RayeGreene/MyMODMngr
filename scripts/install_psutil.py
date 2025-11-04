"""
Install psutil for better NXM protocol executable detection.
This is optional - the protocol will still work without it.
"""

import subprocess
import sys

def install_psutil():
    """Install psutil package for process detection."""
    try:
        import psutil
        print("✓ psutil is already installed")
        print(f"  Version: {psutil.__version__}")
        return True
    except ImportError:
        print("× psutil not found, installing...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "psutil"])
            print("✓ psutil installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            print(f"× Failed to install psutil: {e}")
            print("\nThis is optional. The NXM protocol will still work,")
            print("but may have reduced auto-detection capabilities.")
            return False

if __name__ == "__main__":
    install_psutil()
