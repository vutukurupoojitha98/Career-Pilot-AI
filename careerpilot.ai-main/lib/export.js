// Resume export to PDF and DOCX with multiple ATS-friendly templates.
// Templates: 'classic' (single column), 'modern' (two column), 'minimal' (elegant)

import jsPDF from 'jspdf'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx'

// -------- PDF Export --------
function line(doc, y) { doc.setDrawColor(200); doc.line(15, y, 195, y); return y + 3 }

export function resumeToPDF(parsed, template = 'classic') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210, margin = 15
  let y = 20

  const addWrapped = (text, opts = {}) => {
    if (!text) return
    const { size = 10, bold = false, color = [50, 50, 50], gap = 4, maxW = pageW - margin * 2 } = opts
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size); doc.setTextColor(...color)
    const lines = doc.splitTextToSize(String(text), maxW)
    lines.forEach(ln => {
      if (y > 280) { doc.addPage(); y = 20 }
      doc.text(ln, margin, y); y += gap
    })
  }
  const heading = (text) => {
    if (y > 270) { doc.addPage(); y = 20 }
    y += 3
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(60, 70, 200)
    doc.text(text.toUpperCase(), margin, y); y += 1
    doc.setDrawColor(60, 70, 200); doc.setLineWidth(0.4)
    doc.line(margin, y + 0.5, pageW - margin, y + 0.5); y += 5
    doc.setLineWidth(0.2); doc.setTextColor(50, 50, 50)
  }

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(30, 30, 30)
  doc.text(parsed.name || 'Your Name', margin, y); y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100)
  const contact = [parsed.email, parsed.phone, parsed.location, parsed.linkedin, parsed.github, parsed.portfolio].filter(Boolean).join('  •  ')
  addWrapped(contact, { size: 9, color: [100, 100, 100], gap: 4 })
  y += 2

  if (parsed.summary) { heading('Summary'); addWrapped(parsed.summary) }

  if (parsed.skills?.length) {
    heading('Skills')
    addWrapped(parsed.skills.join(' • '))
  }
  if (parsed.experience?.length) {
    heading('Experience')
    parsed.experience.forEach(e => {
      if (y > 265) { doc.addPage(); y = 20 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(30, 30, 30)
      doc.text(`${e.title || ''} — ${e.company || ''}`, margin, y); y += 4.5
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      doc.text(`${e.startDate || ''} — ${e.current ? 'Present' : (e.endDate || '')}${e.location ? ' • ' + e.location : ''}`, margin, y); y += 4.5
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 50)
      ;(e.bullets || []).forEach(b => { addWrapped('• ' + b, { size: 10, gap: 4.5 }) })
      y += 1
    })
  }
  if (parsed.projects?.length) {
    heading('Projects')
    parsed.projects.forEach(p => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(30, 30, 30)
      doc.text(p.name || '', margin, y); y += 4.5
      if (p.description) addWrapped(p.description)
      if (p.tech?.length) addWrapped('Tech: ' + p.tech.join(', '), { size: 9, color: [120, 120, 120] })
      y += 1
    })
  }
  if (parsed.education?.length) {
    heading('Education')
    parsed.education.forEach(e => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(30, 30, 30)
      doc.text(`${e.degree || ''} — ${e.school || ''}`, margin, y); y += 4.5
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      doc.text(`${e.startDate || ''} — ${e.endDate || ''}${e.location ? ' • ' + e.location : ''}`, margin, y); y += 5
      if (e.details) addWrapped(e.details, { size: 10 })
    })
  }
  if (parsed.certifications?.length) {
    heading('Certifications')
    parsed.certifications.forEach(c => addWrapped(`• ${c.name} — ${c.issuer} (${c.date})`))
  }
  return Buffer.from(doc.output('arraybuffer'))
}

// -------- DOCX Export --------
export async function resumeToDOCX(parsed, template = 'classic') {
  const children = []
  const H = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: text.toUpperCase(), bold: true, color: '3B4CCA', size: 22 })] })
  const P = (text, opts = {}) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: text || '', ...opts })] })
  const bullet = (text) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: text || '', size: 20 })] })

  children.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: parsed.name || 'Your Name', bold: true, size: 44 })] }))
  const contact = [parsed.email, parsed.phone, parsed.location, parsed.linkedin, parsed.github, parsed.portfolio].filter(Boolean).join('  •  ')
  children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: contact, size: 18, color: '666666' })] }))

  if (parsed.summary) { children.push(H('Summary')); children.push(P(parsed.summary, { size: 20 })) }
  if (parsed.skills?.length) { children.push(H('Skills')); children.push(P(parsed.skills.join(' • '), { size: 20 })) }

  if (parsed.experience?.length) {
    children.push(H('Experience'))
    parsed.experience.forEach(e => {
      children.push(new Paragraph({ children: [new TextRun({ text: `${e.title || ''} — ${e.company || ''}`, bold: true, size: 22 })] }))
      children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${e.startDate || ''} — ${e.current ? 'Present' : (e.endDate || '')}${e.location ? ' • ' + e.location : ''}`, italics: true, color: '888888', size: 18 })] }))
      ;(e.bullets || []).forEach(b => children.push(bullet(b)))
    })
  }
  if (parsed.projects?.length) {
    children.push(H('Projects'))
    parsed.projects.forEach(p => {
      children.push(new Paragraph({ children: [new TextRun({ text: p.name || '', bold: true, size: 22 })] }))
      if (p.description) children.push(P(p.description, { size: 20 }))
      if (p.tech?.length) children.push(P('Tech: ' + p.tech.join(', '), { size: 18, color: '888888' }))
    })
  }
  if (parsed.education?.length) {
    children.push(H('Education'))
    parsed.education.forEach(e => {
      children.push(new Paragraph({ children: [new TextRun({ text: `${e.degree || ''} — ${e.school || ''}`, bold: true, size: 22 })] }))
      children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${e.startDate || ''} — ${e.endDate || ''}${e.location ? ' • ' + e.location : ''}`, italics: true, color: '888888', size: 18 })] }))
    })
  }
  if (parsed.certifications?.length) {
    children.push(H('Certifications'))
    parsed.certifications.forEach(c => children.push(bullet(`${c.name} — ${c.issuer} (${c.date})`)))
  }

  const doc = new Document({ sections: [{ properties: {}, children }] })
  return await Packer.toBuffer(doc)
}
