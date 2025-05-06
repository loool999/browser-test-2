"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressData = compressData;
exports.decompressData = decompressData;
exports.compressBase64 = compressBase64;
exports.decompressBase64 = decompressBase64;
exports.getCompressionRatio = getCompressionRatio;
const pako_1 = require("pako");
/**
 * Compress data using pako (zlib) implementation
 * @param data - The data to compress
 * @returns Compressed data as Uint8Array
 */
function compressData(data) {
    try {
        // If string convert to Uint8Array
        const inputData = typeof data === 'string'
            ? new TextEncoder().encode(data)
            : data;
        return (0, pako_1.deflate)(inputData, { level: 6 });
    }
    catch (error) {
        console.error('Compression error:', error);
        throw error;
    }
}
/**
 * Decompress data using pako (zlib) implementation
 * @param data - The compressed data to decompress
 * @param asString - Whether to return as string (default: false)
 * @returns Decompressed data as Uint8Array or string
 */
function decompressData(data, asString = false) {
    try {
        const decompressed = (0, pako_1.inflate)(data);
        if (asString) {
            return new TextDecoder().decode(decompressed);
        }
        return decompressed;
    }
    catch (error) {
        console.error('Decompression error:', error);
        throw error;
    }
}
/**
 * Compress a base64 string
 * @param base64Data - The base64 data to compress
 * @returns Compressed base64 string
 */
function compressBase64(base64Data) {
    // Extract actual base64 data without MIME type prefix
    const base64WithoutPrefix = base64Data.split(',')[1] || base64Data;
    // Convert base64 to binary
    const binaryData = Buffer.from(base64WithoutPrefix, 'base64');
    // Compress the binary data
    const compressed = compressData(binaryData);
    // Convert back to base64
    return Buffer.from(compressed).toString('base64');
}
/**
 * Decompress a compressed base64 string
 * @param compressedBase64 - The compressed base64 data
 * @param withPrefix - Whether to add data URL prefix (default: false)
 * @param mimeType - MIME type for the prefix
 * @returns Decompressed base64 string
 */
function decompressBase64(compressedBase64, withPrefix = false, mimeType = 'image/jpeg') {
    // Convert base64 to binary
    const binaryData = Buffer.from(compressedBase64, 'base64');
    // Decompress the binary data
    const decompressed = decompressData(binaryData);
    // Convert back to base64
    const result = Buffer.from(decompressed).toString('base64');
    // Add data URL prefix if requested
    return withPrefix ? `data:${mimeType};base64,${result}` : result;
}
/**
 * Calculate compression ratio
 * @param original - Original data size
 * @param compressed - Compressed data size
 * @returns Compression ratio as percentage
 */
function getCompressionRatio(original, compressed) {
    if (original === 0)
        return 0;
    const ratio = (1 - (compressed / original)) * 100;
    return parseFloat(ratio.toFixed(2));
}
//# sourceMappingURL=compression.js.map