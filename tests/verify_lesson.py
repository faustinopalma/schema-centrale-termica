"""Verify the 3-step progressive plant site, continuous animation, tag explorer and privacy."""

import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

from verify import ROOT, verify_files


def verify_privacy() -> None:
    private_files = list((ROOT / "private").glob("*.pdf"))
    assert len(private_files) == 1
    original = private_files[0]
    original_hash = hashlib.sha256(original.read_bytes()).hexdigest()
    public = ROOT / "dist"
    assert not (ROOT / original.name).exists()
    for file in public.rglob("*"):
        if not file.is_file():
            continue
        assert "private" not in file.relative_to(public).parts
        raw = file.read_bytes()
        assert hashlib.sha256(raw).hexdigest() != original_hash, file
        if file.suffix in {".html", ".json", ".svg"}:
            text = raw.decode("utf-8")
            assert original.name not in text, file
            assert "private/" not in text and "private\\" not in text, file
    with tempfile.TemporaryDirectory(prefix="plant-ignore-check-") as folder:
        subprocess.run(["git", "init", "--quiet", folder], check=True)
        result = subprocess.run(
            ["git", "--git-dir", str(Path(folder) / ".git"), "--work-tree", str(ROOT),
             "check-ignore", "--no-index", str(original), str(public / "index.html")],
            check=True, capture_output=True, text=True,
        )
        assert len(result.stdout.strip().splitlines()) == 2
    assert (public / ".nojekyll").exists()
    assert (ROOT / "src" / "data" / "plant-graph.json").read_bytes() == (public / "plant-graph.json").read_bytes()
    print("PASS: original remains private and ignored; published bytes match")


def verify_fit(page: Page, scope_svg: str = "#viewport > svg.scene") -> None:
    assert page.evaluate("""()=>document.documentElement.scrollHeight<=innerHeight &&
        document.documentElement.scrollWidth<=innerWidth && scrollX===0 && scrollY===0""")
    header_overflow = page.evaluate("""()=>{
        return [...document.querySelectorAll('header button, header select')]
          .filter(e => e.checkVisibility())
          .some(e => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 1; });
    }""")
    assert not header_overflow, "Header controls overflowed viewport width"
    assert page.evaluate("""()=>['body','header button','.vector-map'].every(sel=>{
        const el=document.querySelector(sel);
        const s=getComputedStyle(el);
        return (s.userSelect==='none'||s.webkitUserSelect==='none');
    })"""), "Accidental mobile text selection must be disabled on UI and map"
    problems = page.locator(scope_svg).evaluate("""svg=>{
        const errors=[],box=svg.viewBox.baseVal;
        const texts=[...svg.querySelectorAll('text')].filter(t=>getComputedStyle(t).display!=='none'&&t.checkVisibility());
        for(const t of texts){
            const b=t.getBBox();
            if(b.x<-2||b.y<-2||b.x+b.width>box.width+2||b.y+b.height>box.height+2)
                errors.push('Clipped label: '+t.textContent);
        }
        for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
            const a=texts[i].getBBox(),b=texts[j].getBBox();
            if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1.5 &&
               Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1.5)
                errors.push('Overlapping labels: '+texts[i].textContent+' / '+texts[j].textContent);
        }
        for(const e of svg.querySelectorAll('[data-edge]')){
            for(const [attr,length] of [['data-from',0],['data-to',e.getTotalLength()]]){
                const p=svg.querySelector('[data-port="'+e.getAttribute(attr)+'"]'),v=e.getPointAtLength(length);
                if(!p||Math.hypot(v.x-p.cx.baseVal.value,v.y-p.cy.baseVal.value)>.1)
                    errors.push('Disconnected pipe: '+e.dataset.edge);
            }
        }
        const flowSamples=[...svg.querySelectorAll('[data-flow-path="1"]')].map((path,idx)=>{
            const len=path.getTotalLength(),pts=[];
            for(let s=10;s<len-10;s+=5){
                const pt=path.getPointAtLength(s);
                pts.push([pt.x,pt.y]);
            }
            return {idx,d:path.getAttribute('d').slice(0,32),pts};
        });
        for(let i=0;i<flowSamples.length;i++){
            for(let j=i+1;j<flowSamples.length;j++){
                let hit=false;
                for(const [ax,ay] of flowSamples[i].pts){
                    for(const [bx,by] of flowSamples[j].pts){
                        if(Math.abs(ax-bx)<3.5&&Math.abs(ay-by)<3.5&&Math.hypot(ax-bx,ay-by)<3.5){
                            errors.push('Visual pipe crossing/overlap: '+flowSamples[i].d+' vs '+flowSamples[j].d+' near ('+Math.round(ax)+','+Math.round(ay)+')');
                            hit=true;break;
                        }
                    }
                    if(hit)break;
                }
            }
            const textBoxes=texts.map(t=>({txt:t.textContent,b:t.getBBox()}));
            for(const sample of flowSamples){
                for(const [px,py] of sample.pts){
                    for(const tb of textBoxes){
                        if(px>tb.b.x+2&&px<tb.b.x+tb.b.width-2&&py>tb.b.y+3&&py<tb.b.y+tb.b.height-3){
                            errors.push('Pipe crosses text label: '+tb.txt+' at ('+Math.round(px)+','+Math.round(py)+')');
                            break;
                        }
                    }
                }
            }
        }
        for(const grp of svg.querySelectorAll('[data-stage], .cycle-center-note')){
            const r=grp.querySelector('rect');
            if(!r)continue;
            const rb=r.getBBox();
            for(const t of grp.querySelectorAll('text')){
                if(getComputedStyle(t).display==='none'||!t.checkVisibility())continue;
                const tb=t.getBBox();
                if(tb.x<rb.x+2||tb.x+tb.width>rb.x+rb.width-2||tb.y<rb.y+2||tb.y+tb.height>rb.y+rb.height-2)
                    errors.push('Text overflows card box: '+t.textContent);
            }
        }
        return errors;
    }""")
    assert not problems, problems
    ids = page.locator("[id]").evaluate_all("es=>es.map(e=>e.id)")
    assert len(ids) == len(set(ids)), "Duplicate HTML/SVG IDs"


def verify_lesson(screenshots: Path | None) -> None:
    copy = json.loads((ROOT / "src" / "data" / "lesson-content.json").read_text(encoding="utf-8"))
    if screenshots:
        screenshots.mkdir(parents=True, exist_ok=True)
    url = (ROOT / "dist" / "index.html").as_uri() + "?scoutTheme=light"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=False)
        try:
            for locale, expected in [("it-IT", "it"), ("zh-TW", "zh"), ("en-GB", "en"), ("de-DE", "en")]:
                context = browser.new_context(locale=locale, offline=True, reduced_motion="reduce")
                page = context.new_page()
                page.goto(url)
                assert page.locator("html").get_attribute("lang") == expected
                first_particle = page.locator(".flow-layer > *").first
                t0 = first_particle.get_attribute("transform")
                page.wait_for_timeout(120)
                assert first_particle.get_attribute("transform") == t0, "Reduced motion must keep particles static"
                context.close()

            context = browser.new_context(offline=True, locale="en-US", viewport={"width": 1440, "height": 900})
            context.add_init_script("Object.defineProperty(navigator,'languages',{get:()=>['fr-FR','it-IT','en-US']})")
            page = context.new_page()
            errors: list[str] = []
            requests: list[str] = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append(request.url))
            page.goto(url)
            assert page.locator("html").get_attribute("lang") == "it"

            # Verify continuous rAF particle & rotor animation runs smoothly
            particle = page.locator(".flow-layer > *").first
            before_tf = particle.get_attribute("transform")
            page.wait_for_timeout(180)
            assert particle.get_attribute("transform") != before_tf, "Continuous flow animation must advance"

            # Verify opens on Step 1 (1 theoretical HP) and progresses sequentially 1 -> 2 -> 3
            assert page.locator("#step-tab-0").get_attribute("aria-pressed") == "true"
            assert page.locator("#viewport > svg").get_attribute("data-diagram") == "step1"
            assert page.locator("#prev-step").is_disabled()
            page.locator("#next-step").click()
            assert page.locator("#viewport > svg").get_attribute("data-diagram") == "step2"
            page.locator("#next-step").click()
            assert page.locator("#viewport > svg").get_attribute("data-diagram") == "step3"
            assert page.locator("#next-step").is_disabled()
            page.locator("#prev-step").click()
            assert page.locator("#viewport > svg").get_attribute("data-diagram") == "step2"
            page.locator("#prev-step").click()
            assert page.locator("#viewport > svg").get_attribute("data-diagram") == "step1"

            geometries: dict[int, list[str]] = {}
            for width, height in [(1440, 900), (1280, 800), (844, 390), (667, 375), (568, 320)]:
                page.set_viewport_size({"width": width, "height": height})
                is_pc = width >= 1024 and height >= 580
                assert page.locator("#pc-context").is_visible() == is_pc
                min_step_btn_w = 44 if width >= 660 else 34
                for s_idx in [0, 1, 2]:
                    btn_box = page.locator(f"#step-tab-{s_idx}").bounding_box()
                    assert btn_box and btn_box["width"] >= min_step_btn_w, f"Step button {s_idx+1} too narrow ({btn_box}) at {width}x{height}"
                for language in ["it", "en", "zh"]:
                    page.locator("#language").select_option(language)
                    for step in [0, 1, 2]:
                        page.locator(f"#step-tab-{step}").click()
                        pc_detail_visible = page.locator("#viewport .pc-detail").first.is_visible()
                        assert pc_detail_visible == is_pc
                        for season in ["winter", "summer"]:
                            page.locator(f"#{season}").click()
                            verify_fit(page)
                            assert not page.locator("#orientation").is_visible()
                            edges = page.locator("#viewport [data-edge]").evaluate_all("es=>es.map(e=>e.getAttribute('d'))")
                            if step not in geometries:
                                geometries[step] = edges
                            assert geometries[step] == edges, "Pipe geometry must stay invariant across seasons/sizes"

                            floor = page.locator('#viewport [data-channel="load.in-out"]')
                            assert floor.get_attribute("data-temperature-from") == ("danger" if season == "winter" else "link")
                            assert floor.get_attribute("data-temperature-to") == ("link" if season == "winter" else "danger")

                            if step in [1, 2]:
                                prefix = "s2" if step == 1 else "s3"
                                assert page.locator(f'#viewport [data-edge="{prefix}-acr-mix"]').get_attribute("data-temperature-from") == "warning"
                                assert page.locator(f'#viewport [data-edge="{prefix}-afp-s2"]').get_attribute("data-temperature-from") == "link"
                                assert page.locator('#viewport [data-draw-off="true"]').count() == 1

                            if screenshots and language == "it" and width in [1440, 844]:
                                page.screenshot(path=str(screenshots / f"step{step + 1}-{width}-{season}.png"))

            # Verify interactive refrigeration cycle zoom modal across all 3 languages & Prev/Next buttons
            page.set_viewport_size({"width": 1440, "height": 900})
            for cyc_lang in ["it", "en", "zh"]:
                page.locator("#language").select_option(cyc_lang)
                page.locator("#step-tab-0").click()
                page.locator('#viewport [data-node="pc2"]').click()
                assert page.locator("#popup").is_visible()
                page.locator("#extra-action").click()
                verify_fit(page, "#popup svg.scene")
                assert page.locator("#page-count").inner_text() == "1 / 4"
                assert page.locator("#previous").is_disabled()
                page.locator("#next").click()
                assert page.locator("#page-count").inner_text() == "2 / 4"
                assert copy[cyc_lang]["stages"][1] in page.locator(".cycle-stage-bar").inner_text()
                if screenshots and cyc_lang == "it":
                    page.screenshot(path=str(screenshots / "cycle-zoom-1440.png"))
                page.locator('#popup [data-stage="2"]').click()
                assert page.locator("#page-count").inner_text() == "3 / 4"
                assert copy[cyc_lang]["stages"][2] in page.locator(".cycle-stage-bar").inner_text()
                page.locator("#next").click()
                assert page.locator("#page-count").inner_text() == "4 / 4"
                assert page.locator("#next").is_disabled()
                page.locator("#previous").click()
                assert page.locator("#page-count").inner_text() == "3 / 4"
                page.locator("#extra-action").click()
                assert page.locator("#popup-title").inner_text() == copy[cyc_lang]["richTopics"]["cycle"]["title"]
                page.keyboard.press("Escape")
                assert not page.locator("#popup").is_visible()
            page.locator("#language").select_option("it")

            # Verify Cycle & Sigle modals on mobile landscape (844x390 & 667x375) fit side-by-side AND clear camera punch-hole / Dynamic Island
            for m_w, m_h in [(844, 390), (667, 375)]:
                page.set_viewport_size({"width": m_w, "height": m_h})
                page.locator("#step-tab-0").click()
                page.locator('#viewport [data-node="pc2"]').click()
                dlg_b = page.locator("#popup").bounding_box()
                assert dlg_b and dlg_b["x"] >= 48 and (m_w - (dlg_b["x"] + dlg_b["width"])) >= 48, f"Dialog hit camera punch-hole zone: {dlg_b} on {m_w}x{m_h}"
                page.locator("#extra-action").click()
                verify_fit(page, "#popup svg.scene")
                svg_b = page.locator(".cycle-svg-box").bounding_box()
                bar_b = page.locator(".cycle-stage-bar").bounding_box()
                assert svg_b and bar_b and bar_b["y"] < m_h - 40 and bar_b["x"] > svg_b["x"], "Mobile cycle modal must show SVG and stage text side-by-side"
                if screenshots and m_w == 844:
                    page.screenshot(path=str(screenshots / "mobile-844-cycle.png"))
                page.keyboard.press("Escape")

                page.locator("#tags-btn").click()
                dlg_t = page.locator("#popup").bounding_box()
                assert dlg_t and dlg_t["x"] >= 48 and (m_w - (dlg_t["x"] + dlg_t["width"])) >= 48, f"Sigle dialog hit camera punch-hole zone: {dlg_t} on {m_w}x{m_h}"
                grid_b = page.locator(".tag-grid").bounding_box()
                card_b = page.locator(".tag-detail-card").bounding_box()
                assert grid_b and card_b and card_b["y"] < m_h - 40 and card_b["x"] > grid_b["x"], "Mobile Sigle modal must show grid and detail card side-by-side"
                if screenshots and m_w == 844:
                    page.screenshot(path=str(screenshots / "mobile-844-tags.png"))
                page.keyboard.press("Escape")

            page.set_viewport_size({"width": 1440, "height": 900})

            # Verify interactive Sigle explorer & highlight-on-schematic jump
            page.locator("#tags-btn").click()
            assert page.locator("#popup").is_visible()
            for tag_code in ["P11", "S3", "SC2", "P02", "ACR"]:
                page.locator(f'#popup [data-select-tag="{tag_code}"]').click()
                assert copy["it"]["tags"][tag_code]["name"] in page.locator(".tag-detail-card").inner_text()
            if screenshots:
                page.screenshot(path=str(screenshots / "tags-explorer-1440.png"))
            page.locator('#popup [data-locate-tag="ACR"]').click()
            assert not page.locator("#popup").is_visible()
            assert page.locator("#viewport > svg").get_attribute("data-diagram") == "step3"
            assert page.locator("#viewport .highlighted").count() >= 1

            # Verify portrait rotation screen & explicit PC recommendation
            for width, height in [(390, 844), (320, 568), (768, 1024)]:
                page.set_viewport_size({"width": width, "height": height})
                assert page.locator("#orientation").is_visible()
                assert page.locator("#rotate-pc").is_visible()
                assert "PC" in page.locator("#rotate-pc").inner_text() or "电脑" in page.locator("#rotate-pc").inner_text()
                assert page.evaluate("scrollY===0 && document.documentElement.scrollHeight<=innerHeight")
                if screenshots and width == 390:
                    page.screenshot(path=str(screenshots / "portrait-390.png"))

            # Verify public datasheets open inside guide modal & dark theme works
            page.set_viewport_size({"width": 1440, "height": 900})
            page.locator("#guide").click()
            for doc in ["msw", "ksw"]:
                page.locator(f'[data-document="{doc}"]').click()
                assert page.locator("iframe.doc-viewer").get_attribute("src") == f"documents/hiref-{doc}.pdf"
            page.locator("#close").click()
            page.locator("#theme-btn").click()
            assert page.locator("html").get_attribute("data-theme") == "dark"
            verify_fit(page)
            if screenshots:
                page.locator("#step-tab-2").click()
                page.screenshot(path=str(screenshots / "step3-dark-1440.png"))

            assert not errors, errors
            assert not [r for r in requests if r.startswith(("http:", "https:"))]
            assert page.locator("a[href]").count() == 0
            context.close()
            print("PASS: 3 sequential steps (90 combinations), continuous rAF animation, PC vs mobile details, portrait + PC invite, cycle zoom, Sigle explorer, accurate DHW recirculation and privacy")
        finally:
            browser.close()


if __name__ == "__main__":
    verify_files()
    verify_privacy()
    verify_lesson(Path(sys.argv[1]) if len(sys.argv) > 1 else None)
