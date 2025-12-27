// Minimal tar writer + gzip using CompressionStream (available in Workers)
// Supports regular files only.

function padTo512(n: number) {
  return (512 - (n % 512)) % 512;
}

function writeOctal(value: number, length: number) {
  const s = value.toString(8);
  return s.padStart(length - 1, "0") + "\0";
}

function asciiBytes(s: string, len: number) {
  const enc = new TextEncoder();
  const b = enc.encode(s);
  const out = new Uint8Array(len);
  out.set(b.slice(0, len));
  return out;
}

function tarHeader(path: string, size: number, mtime: number) {
  // POSIX ustar header 512 bytes
  const header = new Uint8Array(512);

  // name (0-99)
  header.set(asciiBytes(path, 100), 0);

  // mode (100-107)
  header.set(asciiBytes(writeOctal(0o644, 8), 8), 100);

  // uid/gid
  header.set(asciiBytes(writeOctal(0, 8), 8), 108);
  header.set(asciiBytes(writeOctal(0, 8), 8), 116);

  // size
  header.set(asciiBytes(writeOctal(size, 12), 12), 124);

  // mtime
  header.set(asciiBytes(writeOctal(mtime, 12), 12), 136);

  // checksum field initially spaces
  for (let i = 148; i < 156; i++) header[i] = 0x20;

  // typeflag '0'
  header[156] = "0".charCodeAt(0);

  // magic + version
  header.set(asciiBytes("ustar\0", 6), 257);
  header.set(asciiBytes("00", 2), 263);

  // uname/gname
  header.set(asciiBytes("worker", 32), 265);
  header.set(asciiBytes("worker", 32), 297);

  // checksum
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  const chk = writeOctal(sum, 8);
  header.set(asciiBytes(chk, 8), 148);

  return header;
}

export async function makeTarGz(files: Array<{ path: string; data: Uint8Array }>): Promise<ReadableStream<Uint8Array>> {
  const tarChunks: Uint8Array[] = [];

  const mtime = Math.floor(Date.now() / 1000);

  for (const f of files) {
    const header = tarHeader(f.path, f.data.byteLength, mtime);
    tarChunks.push(header);
    tarChunks.push(f.data);

    const pad = padTo512(f.data.byteLength);
    if (pad) tarChunks.push(new Uint8Array(pad));
  }

  // Two 512-byte blocks of zeros terminate tar
  tarChunks.push(new Uint8Array(1024));

  const tarStream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of tarChunks) controller.enqueue(c);
      controller.close();
    },
  });

  // gzip
  const cs = new CompressionStream("gzip");
  return tarStream.pipeThrough(cs);
}
