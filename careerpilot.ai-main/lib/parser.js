// Resume file text extraction (PDF/DOCX)
import mammoth from 'mammoth'

async function extractPdfText(buffer) {
  // Use pdfjs-dist legacy build for Node.js compatibility
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const uint8 = new Uint8Array(buffer)
  const loadingTask = pdfjs.getDocument({
    data: uint8,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
  })
  const pdf = await loadingTask.promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const strs = content.items.map(it => it.str).filter(Boolean)
    text += strs.join(' ') + '\n\n'
  }
  return text.trim()
}

export async function extractText(buffer, mimeType, filename = '') {
  const isPdf = mimeType === 'application/pdf' || /\.pdf$/i.test(filename)
  const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(filename)
  if (isPdf) return extractPdfText(buffer)
  if (isDocx) {
    const { value } = await mammoth.extractRawText({ buffer })
    return (value || '').trim()
  }
  try { return buffer.toString('utf-8') } catch { return '' }
}
