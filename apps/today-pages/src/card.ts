import { formatDuration, roundPages, roundSeconds } from './engine';
import type { ReadingRound, State } from './types';

export async function cardPNG(state: State, round: ReadingRound): Promise<Uint8Array> {
  await document.fonts.ready;
  const book = state.books.find(b => b.id === round.bookId)!;
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 기기에서는 카드를 만들 수 없어요.');
  ctx.fillStyle = '#FAF7F1'; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#2F6B4F'; ctx.fillRect(80, 80, 920, 6);
  ctx.font = '28px sans-serif'; ctx.fillText('오늘 몇 쪽 · 완독의 기록', 80, 150);
  ctx.fillStyle = '#E3EADB'; ctx.beginPath(); ctx.ellipse(540, 390, 220, 160, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2F6B4F'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(400, 450); ctx.lineTo(400, 295); ctx.quadraticCurveTo(470, 275, 540, 315); ctx.quadraticCurveTo(610, 275, 680, 295); ctx.lineTo(680, 450); ctx.quadraticCurveTo(610, 430, 540, 470); ctx.quadraticCurveTo(470, 430, 400, 450); ctx.moveTo(540, 315); ctx.lineTo(540, 470); ctx.stroke();
  const wrap = (text: string, y: number, font: string, maxLines: number, lineHeight: number) => {
    ctx.font = font; let line = ''; const lines: string[] = [];
    for (const char of text.replace(/\s+/g, ' ')) {
      if (ctx.measureText(line + char).width > 900) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + '…').width > 900) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    for (const textLine of lines) { ctx.fillText(textLine, 80, y); y += lineHeight; }
    return y;
  };
  ctx.fillStyle = '#283D31'; wrap(book.title, 640, 'bold 54px sans-serif', 2, 70);
  ctx.fillStyle = '#647265'; wrap(book.authors.join(', '), 800, '28px sans-serif', 1, 40);
  if (round.review) wrap(round.review, 885, '26px sans-serif', 2, 36);
  ctx.fillStyle = '#2F6B4F'; ctx.font = 'bold 42px sans-serif'; ctx.fillText(`내가 남긴 ${roundPages(state, round)}쪽`, 80, 1040);
  ctx.fillStyle = '#647265'; ctx.font = '28px sans-serif';
  const seconds = roundSeconds(state, round.id);
  if (seconds > 0) ctx.fillText(`${formatDuration(seconds)} 동안 읽었어요.`, 80, 1090);
  ctx.fillText(`${round.startedOn} — ${round.completedOn}`, 80, 1160);
  ctx.font = '24px sans-serif'; ctx.fillText('한 장씩, 나의 속도로.', 80, 1250);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('카드 생성에 실패했어요.')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
