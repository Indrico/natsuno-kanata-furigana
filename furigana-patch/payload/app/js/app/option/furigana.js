// Local reading assistance. No game text is sent to a remote service.
class Furigana
{
    static enabled = false;
    static tokenizer = null;
    static loading = false;
    static error = false;
    static cache = new Map();
    static observer = null;
    static pending = new Set();
    static frame = null;
    static storageKey = "natsuno-kanata.furigana.enabled";
    static excluded = "script, style, textarea, input, select, ruby, rt, rp, svg, [contenteditable], [data-furigana-skip]";

    static setup()
    {
        try
        {
            Furigana.enabled = localStorage.getItem(Furigana.storageKey) === "true";
        }
        catch (error) { /* Reading assistance also works without storage. */ }

        var button = document.getElementById("furiganaToggle");
        button.onclick = () => { Furigana.toggle(); };
        Furigana.observer = new MutationObserver((records) =>
        {
            if (!Furigana.enabled || !Furigana.tokenizer) return;
            for (var record of records) Furigana.schedule(record.target);
        });
        Furigana.observer.observe(document.getElementById("wrapper"),
            { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["data-furigana-skip"] });
        Furigana.apply();
    }

    static toggle()
    {
        Furigana.enabled = !Furigana.enabled;
        try
        {
            localStorage.setItem(Furigana.storageKey, String(Furigana.enabled));
        }
        catch (error) { /* Keep the current session usable if storage is unavailable. */ }
        Furigana.apply();
    }

    static apply()
    {
        document.documentElement.classList.toggle("furigana-enabled", Furigana.enabled);
        if (Furigana.enabled)
        {
            if (Furigana.tokenizer) Furigana.schedule(document.getElementById("wrapper"));
            else Furigana.load();
        }
        Furigana.updateButton();
    }

    static updateButton()
    {
        var button = document.getElementById("furiganaToggle");
        var status = Furigana.enabled ? "ON" : "OFF";
        if (Furigana.enabled && Furigana.loading) status += " (準備中…)";
        if (Furigana.enabled && Furigana.error) status += " (辞書エラー)";
        button.textContent = `ふりがな : ${status}`;
        button.setAttribute("aria-pressed", String(Furigana.enabled));
    }

    static load()
    {
        if (Furigana.loading) return;
        Furigana.loading = true;
        Furigana.error = false;
        kuromoji.builder({ dicPath: "resources/furigana/dict/" }).build((error, tokenizer) =>
        {
            Furigana.loading = false;
            Furigana.error = !!error;
            if (error)
            {
                console.error("Furigana dictionary could not be loaded", error);
                Furigana.updateButton();
                return;
            }
            Furigana.tokenizer = tokenizer;
            Furigana.apply();
        });
    }

    static schedule(node)
    {
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        if (!node || !node.isConnected || node.closest(Furigana.excluded)) return;
        Furigana.pending.add(node);
        if (Furigana.frame !== null) return;
        Furigana.frame = requestAnimationFrame(() =>
        {
            Furigana.frame = null;
            var roots = Array.from(Furigana.pending);
            Furigana.pending.clear();
            for (var root of roots)
            {
                if (root.isConnected) Furigana.annotate(root);
            }
        });
    }

    static hiragana(text)
    {
        return text.replace(/[ァ-ヶ]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) - 0x60));
    }

    static parts(text)
    {
        if (Furigana.cache.has(text)) return Furigana.cache.get(text);
        var tokens = Furigana.tokenizer.tokenize(text);
        // Unknown characters and whitespace must survive tokenization exactly.
        if (tokens.map((token) => token.surface_form).join("") !== text) return [{ text: text }];
        var parts = [];
        for (var token of tokens)
        {
            var surface = token.surface_form;
            var reading = token.reading;
            if (!/[\u3400-\u9fff\uf900-\ufaff々]/.test(surface) || !reading || reading === "*")
            {
                parts.push({ text: surface });
                continue;
            }
            reading = Furigana.hiragana(reading);
            // Keep matching kana outside the ruby, e.g. 食(た)べる.
            var start = 0;
            var end = surface.length;
            while (start < end && /[ぁ-ヺー]/.test(surface[start]) && Furigana.hiragana(surface[start]) === reading[0])
            {
                start++;
                reading = reading.slice(1);
            }
            while (end > start && /[ぁ-ヺー]/.test(surface[end - 1]) && Furigana.hiragana(surface[end - 1]) === reading[reading.length - 1])
            {
                end--;
                reading = reading.slice(0, -1);
            }
            if (start > 0) parts.push({ text: surface.slice(0, start) });
            parts.push({ text: surface.slice(start, end), reading: reading });
            if (end < surface.length) parts.push({ text: surface.slice(end) });
        }
        if (Furigana.cache.size >= 1000) Furigana.cache.clear();
        Furigana.cache.set(text, parts);
        return parts;
    }

    static annotate(root)
    {
        if (!Furigana.enabled || !Furigana.tokenizer || root.closest(Furigana.excluded)) return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) =>
            {
                if (!/[\u3400-\u9fff\uf900-\ufaff々]/.test(node.data) || node.parentElement.closest(Furigana.excluded))
                    return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (var node of nodes)
        {
            var parts = Furigana.parts(node.data);
            if (!parts.some((part) => part.reading)) continue;
            var fragment = document.createDocumentFragment();
            for (var part of parts)
            {
                if (!part.reading)
                {
                    fragment.appendChild(document.createTextNode(part.text));
                    continue;
                }
                var ruby = document.createElement("ruby");
                ruby.className = "furigana";
                ruby.appendChild(document.createTextNode(part.text));
                var rt = document.createElement("rt");
                rt.textContent = part.reading;
                ruby.appendChild(rt);
                fragment.appendChild(ruby);
            }
            node.replaceWith(fragment);
        }
    }

    static html(html)
    {
        if (!Furigana.enabled || !Furigana.tokenizer) return html;
        var container = document.createElement("span");
        container.innerHTML = html;
        Furigana.annotate(container);
        return container.innerHTML;
    }

    static plainText(element)
    {
        var copy = element.cloneNode(true);
        for (var reading of copy.querySelectorAll("ruby.furigana rt")) reading.remove();
        return copy.textContent;
    }
}

document.addEventListener("DOMContentLoaded", () => { Furigana.setup(); });
