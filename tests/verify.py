"""Validate local evidence, editable diagrams and the offline Edge experience."""

import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pymupdf
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent


def verify_files() -> None:
    data = json.loads((ROOT / "src" / "data" / "plant-data.json").read_text(encoding="utf-8"))
    sources = json.loads((ROOT / "documents" / "sources.json").read_text(encoding="utf-8"))
    ids = {source["id"] for source in sources}
    assert len(ids) == len(sources) == 15
    assert len(data["components"]) == 34
    assert all(set(component["sources"]) <= ids | {"S00"} for component in data["components"])
    for source in sources:
        file = ROOT / source["file"]
        raw = file.read_bytes()
        assert hashlib.sha256(raw).hexdigest() == source["sha256"], file
        assert len(raw) == source["bytes"], file
        with pymupdf.open(file) as pdf:
            assert len(pdf) > 0
            assert any(page.get_text().strip() for page in pdf), file
    for svg in (ROOT / "diagrams").glob("*.svg"):
        doc = ET.parse(svg)
        element_ids = [e.attrib["id"] for e in doc.iter() if "id" in e.attrib]
        assert len(element_ids) == len(set(element_ids)), svg
        assert doc.findall(".//{http://www.w3.org/2000/svg}text"), svg
        if svg.name.startswith("connected-"):
            assert any("data-edge" in element.attrib for element in doc.iter()), svg
            assert any("data-port" in element.attrib for element in doc.iter()), svg
    drawing = ET.parse(ROOT / "diagrams" / "plant-flows.drawio")
    assert len(drawing.findall("diagram")) == 3
    for page in drawing.findall("diagram"):
        graph = page.find("mxGraphModel")
        assert graph is not None
        width, height = float(graph.attrib["pageWidth"]), float(graph.attrib["pageHeight"])
        cells = page.findall(".//mxCell")
        cell_ids = {c.attrib["id"] for c in cells}
        assert len(cell_ids) == len(cells)
        for cell in cells:
            if cell.attrib.get("edge") == "1":
                assert cell.attrib["source"] in cell_ids
                assert cell.attrib["target"] in cell_ids
            if cell.attrib.get("vertex") == "1":
                geometry = cell.find("mxGeometry")
                assert geometry is not None
                assert float(geometry.attrib["x"]) + float(geometry.attrib["width"]) <= width
                assert float(geometry.attrib["y"]) + float(geometry.attrib["height"]) <= height
    with pymupdf.open(ROOT / "diagrams" / "plant-flows.pdf") as pdf:
        assert len(pdf) == 3, f"Expected 3 draw.io PDF pages, got {len(pdf)}"
        for page in pdf:
            assert len(page.get_text().strip()) > 250, "Blank or unreadable diagram page"
    print("PASS: 15 public source PDFs, 34 entries, 3 editable SVGs and 3 draw.io/PDF pages")


def verify_browser(screenshot_dir: Path | None) -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=False)
        try:
            context = browser.new_context(viewport={"width": 1440, "height": 1100}, offline=True)
            page = context.new_page()
            errors: list[str] = []
            requests: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append(request.url))
            url = (ROOT / "dist" / "project.html").as_uri()
            page.goto(url + "?scoutTheme=light")
            assert page.title() == "Mes 600 S | Plant explained"
            assert page.locator("html").get_attribute("data-theme") == "light"
            assert page.locator(".map-panel:visible").count() == 1
            assert page.locator("a").count() == 0, "Information must not navigate away from the map"
            assert page.locator("main article, main details").count() == 0
            assert page.evaluate("document.documentElement.scrollHeight <= innerHeight + 1")
            page.get_by_role("button", name="Switch to dark theme").click()
            assert page.locator("html").get_attribute("data-theme") == "dark"
            page.get_by_role("button", name="Switch to light theme").click()
            all_ids = page.locator("[id]").evaluate_all("els => els.map(e => e.id)")
            assert len(all_ids) == len(set(all_ids)), "Duplicate HTML/SVG IDs"
            for mode, active_nodes, active_edges in [
                ("winter", 3, 2), ("summer", 3, 2), ("dhw", 5, 4), ("combined", 6, 5)
            ]:
                page.locator(f'[data-mode="{mode}"]').click()
                assert page.locator('[data-mode][aria-pressed="true"]').count() == 1
                assert page.locator("#overview .diagram-node:not(.dim)").count() == active_nodes
                assert page.locator("#overview .diagram-edge:not(.dim)").count() == active_edges
                page.locator("#mode-info").click()
                assert page.locator("#info-popup").is_visible()
                assert page.locator("#popup-content li").count() == 4
                page.keyboard.press("Escape")
                assert not page.locator("#info-popup").is_visible()
                for edge_id in ["ground", "space"]:
                    line = page.locator(f'#overview [data-edge="{edge_id}"] path:not(.hit-area)')
                    assert bool(line.get_attribute("marker-start")) == (mode in ["summer", "combined"])
                    assert bool(line.get_attribute("marker-end")) == (mode != "summer")
            initial_url = page.url
            for map_id in ["overview", "dhw-map", "zones-map"]:
                page.locator(f'[data-map="{map_id}"]').click()
                assert page.locator(".map-panel:visible").count() == 1
                frame = page.locator(f"#{map_id}")
                assert frame.is_visible()
                assert frame.evaluate("e => e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1")
                overflow = frame.locator(".diagram-node").evaluate_all("""
                    nodes => nodes.flatMap(n => {
                        const r=n.querySelector('rect').getBBox();
                        return [...n.querySelectorAll('text')]
                          .filter(t=>t.getBBox().x+t.getBBox().width>r.x+r.width-8)
                          .map(t=>t.textContent);
                    })
                """)
                assert not overflow, overflow
                for node in frame.locator(".diagram-node, .diagram-edge").all():
                    node.focus()
                    position = frame.evaluate("e => [e.scrollLeft, e.scrollTop]")
                    page.keyboard.press("Enter")
                    assert page.locator("#info-popup").is_visible()
                    assert len(page.locator("#popup-content").inner_text()) > 80
                    assert page.url == initial_url
                    assert frame.evaluate("e => [e.scrollLeft, e.scrollTop]") == position
                    page.locator("#close-popup").click()
                    assert not page.locator("#info-popup").is_visible()
                    assert node.evaluate("e => document.activeElement === e")
                    assert frame.evaluate("e => [e.scrollLeft, e.scrollTop]") == position
            page.locator('[data-map="overview"]').click()
            page.locator('#overview [data-node="pc1"]').click()
            page.locator('.source > summary').filter(has_text="S01 /").click()
            page.locator('[data-pdf="S01"]').click()
            assert page.locator(".pdf-frame").get_attribute("src") == "documents/hiref-ksw.pdf"
            assert page.url == initial_url
            page.locator('[data-pdf="S01"]').click()
            assert page.locator(".pdf-frame").count() == 0
            page.keyboard.press("Escape")
            page.locator("#guide-info").click()
            assert page.locator(".component").count() == 34
            assert "Items to verify" in page.locator("#popup-content").inner_text()
            page.locator("summary").filter(has_text="All components (34)").click()
            assert page.locator('[data-component="P12"]').is_visible()
            assert page.locator("a").count() == 0
            page.mouse.click(4, 4)
            assert not page.locator("#info-popup").is_visible(), "Backdrop must close the popup"
            for _ in range(3):
                page.locator("#zoom-in").click()
            assert page.locator("#zoom-level").inner_text() == "250%"
            frame = page.locator("#overview")
            frame.evaluate("e => e.scrollTo(250,150)")
            position = frame.evaluate("e => [e.scrollLeft,e.scrollTop]")
            page.locator("#mode-info").click()
            page.keyboard.press("Tab")
            assert page.evaluate("document.activeElement.closest('dialog') !== null"), "Focus must stay in popup"
            page.keyboard.press("Escape")
            assert frame.evaluate("e => [e.scrollLeft,e.scrollTop]") == position
            page.locator('[data-map="dhw-map"]').click()
            page.locator('[data-map="overview"]').click()
            assert page.locator("#zoom-level").inner_text() == "250%"
            assert frame.evaluate("e => [e.scrollLeft,e.scrollTop]") == position
            page.locator("#fit-map").click()
            assert page.locator("#zoom-level").inner_text() == "100%"
            assert frame.evaluate("e => [e.scrollLeft,e.scrollTop]") == [0, 0]
            for theme in ["dark", "light"]:
                page.goto(url + f"?scoutTheme={theme}")
                assert page.locator("html").get_attribute("data-theme") == theme
            if screenshot_dir:
                screenshot_dir.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(screenshot_dir / "desktop.png"))
                page.locator('#overview [data-node="pc1"]').click()
                page.screenshot(path=str(screenshot_dir / "popup.png"))
                page.locator("#close-popup").click()
            page.set_viewport_size({"width": 390, "height": 844})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "Mobile page overflow"
            frame = page.locator("#overview")
            assert frame.evaluate("e => e.scrollWidth <= e.clientWidth + 1"), "Whole map must fit initially"
            assert page.evaluate("document.documentElement.scrollHeight <= innerHeight + 1")
            page.locator("#zoom-in").click()
            page.locator("#zoom-in").click()
            assert frame.evaluate("e => e.scrollWidth > e.clientWidth")
            page.locator("#mode-info").click()
            assert page.locator("#info-popup").is_visible()
            assert page.locator("#info-popup").evaluate("e => e.getBoundingClientRect().right <= innerWidth")
            page.keyboard.press("Escape")
            page.locator("#fit-map").click()
            if screenshot_dir:
                page.screenshot(path=str(screenshot_dir / "mobile.png"))
            assert not errors, errors
            assert not [request for request in requests if request.startswith(("http:", "https:"))], requests
            context.close()
            no_js = browser.new_context(java_script_enabled=False, offline=True)
            static = no_js.new_page()
            static.goto(url)
            assert static.locator("#overview").is_visible()
            assert static.locator("noscript").is_visible()
            no_js.close()
            print("PASS: Edge offline; 3 maps, all node/flow popups, no navigation, focus/viewport restoration, PDF popup, zoom, themes and mobile")
        finally:
            browser.close()


if __name__ == "__main__":
    verify_files()
    verify_browser(Path(sys.argv[1]) if len(sys.argv) > 1 else None)
