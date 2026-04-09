import { ImageData } from 'canvas';

global.ImageData = ImageData as any;

class MockPath2D {
  commands: any[] = [];
  rect(x: number, y: number, w: number, h: number) {
    this.commands.push({ type: 'rect', x, y, w, h });
  }
}
global.Path2D = MockPath2D as any;

// A robust way to patch the context prototype in JSDOM
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
if (ctx) {
  const ctxProto = Object.getPrototypeOf(ctx);
  const originalFill = ctxProto.fill;
  ctxProto.fill = function(path?: any) {
    if (path instanceof MockPath2D) {
      this.beginPath();
      path.commands.forEach(cmd => {
        if (cmd.type === 'rect') {
          this.rect(cmd.x, cmd.y, cmd.w, cmd.h);
        }
      });
      originalFill.call(this);
    } else {
      originalFill.call(this, path);
    }
  };

  const originalClip = ctxProto.clip;
  ctxProto.clip = function(path?: any) {
    if (path instanceof MockPath2D) {
      this.beginPath();
      path.commands.forEach(cmd => {
        if (cmd.type === 'rect') {
          this.rect(cmd.x, cmd.y, cmd.w, cmd.h);
        }
      });
      originalClip.call(this);
    } else {
      originalClip.call(this, path);
    }
  };
}
