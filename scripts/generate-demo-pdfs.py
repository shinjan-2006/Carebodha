from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from textwrap import wrap
for source in Path("demo-documents").glob("discharge-*.txt"):
    output=source.with_suffix(".pdf")
    doc=canvas.Canvas(str(output),pagesize=A4)
    doc.setTitle("CareBodha fictional discharge document")
    doc.setFont("Helvetica",11)
    y=790
    for paragraph in source.read_text(encoding="utf-8").splitlines():
        for line in wrap(paragraph,width=88):
            doc.drawString(40,y,line)
            y-=20
        y-=8
    doc.save()
print("Three fictional PDF sources generated.")
