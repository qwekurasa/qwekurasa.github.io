function inspectGif(bytes) {
  const label = new TextDecoder('ascii').decode(bytes.slice(0, 6));
  if (!['GIF87a', 'GIF89a'].includes(label) || bytes.length < 14) throw new Error('Некорректный GIF');
  const paletteSize = flags => flags & 128 ? 3 * (1 << ((flags & 7) + 1)) : 0;
  const start = 13 + paletteSize(bytes[10]);
  const loopOffsets = [];
  let offset = start, frames = 0, duration = 0, delay = 100;

  function skipBlocks() {
    while (offset < bytes.length) {
      const size = bytes[offset++];
      if (!size) return;
      offset += size;
    }
    throw new Error('Повреждённый GIF');
  }

  while (offset < bytes.length) {
    const type = bytes[offset++];
    if (type === 0x3b) return { start, loopOffsets, frames, duration };
    if (type === 0x21) {
      const kind = bytes[offset++];
      const size = bytes[offset];
      if (kind === 0xf9 && size === 4) {
        const milliseconds = 10 * (bytes[offset + 2] | bytes[offset + 3] << 8);
        delay = milliseconds < 20 ? 100 : milliseconds;
      } else if (kind === 0xff) {
        const name = new TextDecoder('ascii').decode(bytes.slice(offset + 1, offset + 1 + size));
        const block = offset + 1 + size;
        if (['NETSCAPE2.0', 'ANIMEXTS1.0'].includes(name) && bytes[block] === 3 && bytes[block + 1] === 1) {
          loopOffsets.push(block + 2);
        }
      }
      skipBlocks();
    } else if (type === 0x2c && offset + 9 <= bytes.length) {
      offset += 9 + paletteSize(bytes[offset + 8]) + 1;
      skipBlocks();
      frames++;
      duration += delay;
      delay = 100;
    } else throw new Error('Повреждённый GIF');
  }
  throw new Error('Повреждённый GIF');
}

window.GalleryMedia = {
  async loopGif(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { start, loopOffsets } = inspectGif(bytes);
    bytes.set([71, 73, 70, 56, 57, 97], 0);
    for (const offset of loopOffsets) bytes.fill(0, offset, offset + 2);
    const extension = new Uint8Array([33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]);
    return new Blob(loopOffsets.length ? [bytes] : [bytes.slice(0, start), extension, bytes.slice(start)], { type: 'image/gif' });
  },
  async gifDuration(file) {
    const { frames, duration } = inspectGif(new Uint8Array(await file.arrayBuffer()));
    return frames > 1 ? duration : 3000;
  }
};
