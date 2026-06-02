# 検証用: 様式0/2/3/4 の docx 本文を保ったサンプルPDFを生成する（配布物には含めない）
import glob
import os
import re
import zipfile

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))

OUT_DIR = "samples/forms0234"
os.makedirs(OUT_DIR, exist_ok=True)

# 本番想定のファイル名（prefix_e-Rad所属機関コード_ローマ字氏名）
OUT_NAMES = {
    "様式0": "第2回_様式0_申請様式チェックリスト_1234_TaroYamada.pdf",
    "様式2": "第2回_様式2_審査手法及び応募に係る情報の取扱い等に関する同意確認書_1234_TaroYamada.pdf",
    "様式3": "第2回_様式3_学生応募の同意確認書_1234_TaroYamada.pdf",
    "様式4": "第2回_様式4_指導教員等の同意確認書_1234_TaroYamada.pdf",
}


def docx_paragraphs(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8", "ignore")
    xml = xml.replace("</w:p>", "\n")
    xml = re.sub(r"<w:tab[^>]*/>", "　", xml)
    paras = []
    for chunk in xml.split("\n"):
        texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", chunk, flags=re.S)
        line = "".join(texts)
        line = (line.replace("&amp;", "&").replace("&lt;", "<")
                    .replace("&gt;", ">").replace("&#9;", "　"))
        if line.strip():
            paras.append(line)
    return paras


def which_form(path):
    name = os.path.basename(path)
    for key in OUT_NAMES:
        if key.replace("様式", "様式") in name:
            pass
    if "様式0" in name:
        return "様式0"
    if "様式2" in name:
        return "様式2"
    if "様式3" in name:
        return "様式3"
    if "様式4" in name:
        return "様式4"
    return None


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


style = ParagraphStyle(
    "JP", fontName="HeiseiKakuGo-W5", fontSize=10.5, leading=16,
)

for src in sorted(glob.glob("samples/forms0234_src/*.docx")):
    form = which_form(src)
    if not form:
        continue
    out = os.path.join(OUT_DIR, OUT_NAMES[form])
    doc = SimpleDocTemplate(out, pagesize=A4,
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=20 * mm, bottomMargin=20 * mm)
    flow = []
    for para in docx_paragraphs(src):
        flow.append(Paragraph(esc(para), style))
        flow.append(Spacer(1, 3))
    doc.build(flow)
    print("生成:", out)

print("完了")
