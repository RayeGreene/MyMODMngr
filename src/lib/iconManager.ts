/**
 * Icon Management for RivalNxt
 * Icons should be stored in: C:\Users\rouna\AppData\Roaming\com.rivalnxt.modmanager\icons
 * 
 * This module provides path management and URL generation for icons.
 * The actual file copying should be implemented when the fs plugin is properly configured.
 */

export interface IconConfig {
  filename: string;
  sourcePath: string; // Path in the bundled app
  description: string;
}

export const ICON_CONFIGS: IconConfig[] = [
  {
    filename: "kofi.svg",
    sourcePath: "/icons/kofi.svg",
    description: "Ko-fi donation icon"
  },
  {
    filename: "upi.svg", 
    sourcePath: "/icons/upi.svg",
    description: "UPI donation icon"
  },
  {
    filename: "qr.png",
    sourcePath: "/icons/qr.png", 
    description: "UPI QR code"
  }
];

export const ICONS_DIR_NAME = "icons";

/**
 * Check if we're running in Tauri environment
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Get the username for the roaming directory path
 */
function getUsername(): string {
  // In production, this would get the actual username dynamically
  // For now, use the specified username
  return "rouna";
}

/**
 * Get the path to the local icons directory in roaming app data
 * Returns: C:\Users\rouna\AppData\Roaming\com.rivalnxt.modmanager\icons
 */
export function getIconsDirectoryPath(): string {
  const username = getUsername();
  return `C:\\Users\\${username}\\AppData\\Roaming\\com.rivalnxt.modmanager\\${ICONS_DIR_NAME}`;
}

/**
 * Get the full path to a specific icon file
 */
export function getIconPath(filename: string): string {
  return `${getIconsDirectoryPath()}\\${filename}`;
}

/**
 * Get icon URL - returns the local file path when in Tauri, or fallback to bundled path
 */
export function getIconUrl(filename: string): string {
  if (isTauri()) {
    // In Tauri, convert to file:// URL for browser consumption
    const localPath = getIconPath(filename);
    return `file://${localPath}`;
  }
  
  // Fallback to bundled resource during development
  const config = ICON_CONFIGS.find(c => c.filename === filename);
  return config ? config.sourcePath : "";
}

/**
 * Placeholder for icon initialization
 * This should be called during app initialization
 * 
 * TODO: Implement actual file copying when @tauri-apps/plugin-fs is available
 */
export async function initializeIcons(): Promise<void> {
  if (!isTauri()) {
    console.log("Not running in Tauri, skipping icon initialization");
    return;
  }

  console.log("Icon initialization - TODO: Implement file copying to roaming directory");
  console.log(`Target directory: ${getIconsDirectoryPath()}`);
  
  // TODO: When fs plugin is available, implement:
  // 1. Check if icons directory exists in roaming path
  // 2. If not, create it
  // 3. Copy each icon from bundled resources to roaming directory
  // 4. Handle errors gracefully
}

/**
 * Get the target roaming directory path as a display string
 */
export function getRoamingDirectoryPath(): string {
  const username = getUsername();
  return `C:\\Users\\${username}\\AppData\\Roaming\\com.rivalnxt.modmanager`;
}

/**
 * Check if we're running in development mode
 */
export function isDevelopmentMode(): boolean {
  return !isTauri() || window.location.hostname === "localhost";
}