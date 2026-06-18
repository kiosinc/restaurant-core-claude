import { describe, it, expect } from 'vitest';
import { IMAGE_SIZES, ImageSize, appendSizeToGsl } from '../imageSizes';

describe('IMAGE_SIZES', () => {
  it('is exactly [200, 400, 800, 1280]', () => {
    expect(IMAGE_SIZES).toEqual([200, 400, 800, 1280]);
  });

  it('exposes ImageSize as a union of the supported sizes (compile-time)', () => {
    const s200: ImageSize = 200;
    const s400: ImageSize = 400;
    const s800: ImageSize = 800;
    const s1280: ImageSize = 1280;
    expect([s200, s400, s800, s1280]).toEqual([200, 400, 800, 1280]);
  });
});

describe('appendSizeToGsl', () => {
  it('appends each supported size as a square suffix', () => {
    expect(appendSizeToGsl('gs://b/foo/bar.jpg', 200)).toBe('gs://b/foo/bar_200x200.jpg');
    expect(appendSizeToGsl('gs://b/foo/bar.jpg', 400)).toBe('gs://b/foo/bar_400x400.jpg');
    expect(appendSizeToGsl('gs://b/foo/bar.jpg', 800)).toBe('gs://b/foo/bar_800x800.jpg');
    expect(appendSizeToGsl('gs://b/foo/bar.jpg', 1280)).toBe('gs://b/foo/bar_1280x1280.jpg');
  });

  it('preserves the extension and its casing', () => {
    expect(appendSizeToGsl('gs://b/foo/bar.PNG', 400)).toBe('gs://b/foo/bar_400x400.PNG');
  });

  it('treats only the final dot as the extension (multi-dot)', () => {
    expect(appendSizeToGsl('gs://b/a.b.c.png', 800)).toBe('gs://b/a.b.c_800x800.png');
  });

  it('appends the suffix with no extension when the filename has none', () => {
    expect(appendSizeToGsl('gs://b/foo/image', 200)).toBe('gs://b/foo/image_200x200');
  });

  it('does not treat a leading dot as an extension', () => {
    expect(appendSizeToGsl('.gitkeep', 200)).toBe('.gitkeep_200x200');
  });

  it('does not treat a leading dot as an extension within a folder', () => {
    expect(appendSizeToGsl('gs://b/foo/.gitkeep', 400)).toBe('gs://b/foo/.gitkeep_400x400');
  });

  it('preserves the directory path and gs scheme', () => {
    expect(appendSizeToGsl('gs://bucket/a/b/c/photo.jpeg', 1280)).toBe(
      'gs://bucket/a/b/c/photo_1280x1280.jpeg',
    );
  });

  it('works on a plain relative locator without a scheme', () => {
    expect(appendSizeToGsl('images/photo.jpg', 400)).toBe('images/photo_400x400.jpg');
    expect(appendSizeToGsl('photo.jpg', 400)).toBe('photo_400x400.jpg');
  });

  it('throws TypeError on an empty string', () => {
    expect(() => appendSizeToGsl('', 200)).toThrow(TypeError);
  });

  it('throws TypeError on whitespace-only input', () => {
    expect(() => appendSizeToGsl('   ', 200)).toThrow(TypeError);
  });

  it('throws TypeError on a non-string input', () => {
    // @ts-expect-error testing runtime guard against non-string input
    expect(() => appendSizeToGsl(null, 200)).toThrow(TypeError);
  });
});
