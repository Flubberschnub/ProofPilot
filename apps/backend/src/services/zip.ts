import type { GeneratedFile } from "../types.js";

type ZipEntry = {
  path: string;
  data: Buffer;
  crc: number;
  offset: number;
};

const crcTable = makeCrcTable();

export function createZip(files: GeneratedFile[]) {
  const entries: ZipEntry[] = [];
  const localParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const entry: ZipEntry = {
      path: safeZipPath(file.path),
      data: Buffer.from(file.content, "utf8"),
      crc: 0,
      offset
    };
    entry.crc = crc32(entry.data);

    const localHeader = createLocalHeader(entry);
    localParts.push(localHeader, entry.data);
    offset += localHeader.length + entry.data.length;
    entries.push(entry);
  }

  const centralParts = entries.map(createCentralDirectoryHeader);
  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const centralOffset = offset;
  const end = createEndOfCentralDirectory(entries.length, centralSize, centralOffset);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function createLocalHeader(entry: ZipEntry) {
  const fileName = Buffer.from(entry.path);
  const header = Buffer.alloc(30 + fileName.length);

  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.data.length, 18);
  header.writeUInt32LE(entry.data.length, 22);
  header.writeUInt16LE(fileName.length, 26);
  header.writeUInt16LE(0, 28);
  fileName.copy(header, 30);

  return header;
}

function createCentralDirectoryHeader(entry: ZipEntry) {
  const fileName = Buffer.from(entry.path);
  const header = Buffer.alloc(46 + fileName.length);

  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.data.length, 20);
  header.writeUInt32LE(entry.data.length, 24);
  header.writeUInt16LE(fileName.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.offset, 42);
  fileName.copy(header, 46);

  return header;
}

function createEndOfCentralDirectory(entryCount: number, centralSize: number, centralOffset: number) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(entryCount, 8);
  header.writeUInt16LE(entryCount, 10);
  header.writeUInt32LE(centralSize, 12);
  header.writeUInt32LE(centralOffset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

function safeZipPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Generated file path is not safe to zip: ${path}`);
  }
  return normalized;
}
