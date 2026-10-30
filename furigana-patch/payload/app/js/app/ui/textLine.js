class TextLine extends UIElement
{
    constructor(index)
    {
        super("textLine", index);
        this.index = index;
        this.window = null;
        this.textWindow = null;
        this.frames = [];
        this.textarea = null;
        this.waitSymbols = [];
        this.currentState = null;
        this.useWriteTimer = true;
        this.animSwitch = false;
        this.queue = [];
        this.currentTag = null;
        this.animationBox = [];
        this.requireScroll = false;
        this.visible = true;
        this.animator = new Animator();
        this.textWaitTimeIndex = 0;
        this.textWaitTime = 0;
        this.isForceScrollBottom = false;

        this.setTextWaitTime(0);
    }

    static get state()
    {
        var state =
        {
            none: -1,
            busy: 0,
            waiting: 1,
            enter: 2,
        };
        return state;
    }

    static get textWaitTimes()
    {
        var result = [0.04, 0.001, 0.1, 0];
        return result;
    }

    static get writeIntervalTime()
    {
        return 0.5;
    }

    static get periodSymbols()
    {
        var result =
            [
                ",",
                ".",
                "!",
                "?",
                "、",
                "。",
                "！",
                "？",
            ];
        return result;
    }

    get isWriting()
    {
        return (this.animationBox.length > 0);
    }

    get isTextWriting()
    {
        if (this.animationBox.length == 0)
        {
            return false;
        }

        var box = this.animationBox[0];
        var result = (box.hide.innerHTML.length > 0);
        return result;
    }

    get hasQueue()
    {
        var result = (this.queue.length > 0);
        return result;
    }

    get isBusy()
    {
        if (this.hasQueue)
        {
            return true;
        }
        if (this.isWriting)
        {
            return true;
        }
        return false;
    }

    get isDisplay()
    {
        if (this.textWindow == null)
        {
            return false;
        }
        var result = this.textWindow.style.display == "inline";
        return result;
    }

    get scrollThreshold()
    {
        return this.textarea.clientHeight * 0.6;
    }

    get isScrollBottom()
    {
        if (this.textarea == null)
        {
            return false;
        }

        var bottom = this.textarea.scrollHeight - this.textarea.clientHeight;
        var diff = bottom - this.textarea.scrollTop;
        var result = diff < this.scrollThreshold;
        return result;
    }

    setup()
    {
        var quest = document.getElementById(`questTextArea${this.index}`);
        quest.onwheel = (event) =>
        {
            this.cancelScroll();
            event.stopPropagation();
        };
        if (Platform.isMobile)
        {
            quest.addEventListener('scroll', function (event)
            {
                for (var i = 0; i < 2; i++)
                {
                    var textarea = document.getElementById(`questTextArea${i}`);
                    if (textarea.scrollTop === 0)
                    {
                        textarea.scrollTop = 1;
                    }
                    else if (textarea.scrollTop + textarea.clientHeight === textarea.scrollHeight)
                    {
                        textarea.scrollTop = textarea.scrollTop - 1;
                    }
                }
            }, { passive: false });
        }

        var logue = document.getElementById(`logueTextArea${this.index}`);
        if (this.index == 0)
        {
            logue.onwheel = (event) =>
            {
                this.cancelScroll();
                event.stopPropagation();
            };
            if (Platform.isMobile)
            {
                logue.addEventListener('scroll', function (event)
                {
                    var textarea = document.getElementById("logueTextArea0");
                    if (textarea.scrollTop === 0)
                    {
                        textarea.scrollTop = 1;
                    }
                    else if (textarea.scrollTop + textarea.clientHeight === textarea.scrollHeight)
                    {
                        textarea.scrollTop = textarea.scrollTop - 1;
                    }
                }, { passive: false });
            }
        }
    }

    update()
    {
        this.updateDisplay();
        this.updateWrite();
        this.updateBoxAnimation();
        this.upadteScroll();

        this.animator.update();
    }

    setupElement(id)
    {
        this.textWindow = document.getElementById(`${id}Text${this.index}`);
        this.frames.push(document.getElementById(`${id}TextTopMarginFore${this.index}`));
        this.frames.push(document.getElementById(`${id}TextBottomMarginFore${this.index}`));
        this.textarea = document.getElementById(`${id}TextArea${this.index}`);
        this.textarea.style.opacity = 1;
        this.waitSymbols = [];
        for (var i = 0; i < 3; i++)
        {
            var symbol = document.getElementById(`${id}TextSymbol${this.index}_${i}`);
            this.waitSymbols.push(symbol);
        }

        globalSystem.textLineManager.setupElement(id);
    }

    updateDisplay()
    {
        if (this.textWindow == null)
        {
            return;
        }

        var survivor = globalSystem.survivorManager.survivors[this.index];
        if (survivor != null && this.visible)
        {
            this.textWindow.style.display = "inline";
            for (var frame of this.frames)
            {
                if (frame == null)
                {
                    continue;
                }
                frame.style.display = "inline";
            }
        }
        else
        {
            this.textWindow.style.display = "none";
            for (var frame of this.frames)
            {
                if (frame == null)
                {
                    continue;
                }
                frame.style.display = "none";
            }
        }
    }

    updateWrite()
    {
        if (this.hasQueue == false)
        {
            return;
        }

        if (this.isWriting)
        {
            return;
        }

        var data = this.queue.shift();
        var text = data.text;
        var name = data.name;
        var skippable = data.skippable;
        var box = document.createElement("div");
        box.style.position = "relative";
        box.style.boxSizing = "content-box";
        box.style.padding = "3%";
        var textSpan = document.createElement("span");
        textSpan.setAttribute("data-furigana-skip", "");
        textSpan.style.color = data.color;
        if (name != null)
        {
            textSpan.innerHTML = Furigana.html(`${name}<br>　`);
        }
        box.appendChild(textSpan);
        var hideSpan = document.createElement("span");
        hideSpan.style.opacity = 0;
        hideSpan.innerHTML = Furigana.html(text);
        hideSpan.setAttribute("data-furigana-skip", "");
        box.appendChild(hideSpan);
        this.textarea.appendChild(box);
        var textTimer = 0;
        var bgTimer = 0;
        if (text != null && text != "<br>")
        {
            bgTimer = 1.0;
        }
        var anim = { element: box, text: textSpan, hide: hideSpan, textTimer: textTimer, bgTimer: bgTimer, skippable: skippable };
        this.animationBox.push(anim);

        if (this.textarea.scrollHeight > this.textarea.clientHeight)
        {
            if (this.isForceScrollBottom)
            {
                // 強制スクロール
                this.requireScroll = true;
            }
            else
            {
                this.requireScroll = true;
                this.isForceScrollBottom = false;
            }
        }

        globalSystem.soundManager.playSe("write00");
    }

    updateBoxAnimation()
    {
        if (this.animationBox.length == 0)
        {
            return;
        }

        var box = this.animationBox[0];
        if (this.textWaitTime == 0)
        {
            this.skipTextAnimation();
        }
        else
        {
            if (box.hide.innerHTML.length > 0)
            {
                box.textTimer += 1.0 * globalSystem.time.deltaTime;
                if (box.textTimer > this.textWaitTime)
                {
                    this.updateText(box);
                }
            }
        }

        // 背面が白く光るエフェクト
        var color = 0;
        if (box.bgTimer > 0)
        {
            box.bgTimer -= 1.0 * globalSystem.time.deltaTime;
            color = 0.5 * box.bgTimer;
        }
        box.element.style.backgroundColor = `rgba(255,255,255,${color})`;
    }

    updateText(box)
    {
        if (box.hide.innerHTML.length == 0)
        {
            return;
        }

        // Move complete markup so nested ruby, colors and command buttons stay intact.
        var first = box.hide.firstChild;
        if (first.nodeType == Node.TEXT_NODE)
        {
            var letter = Array.from(first.data)[0];
            var last = box.text.lastChild;
            if (last != null && last.nodeType == Node.TEXT_NODE) last.appendData(letter);
            else box.text.appendChild(document.createTextNode(letter));
            first.deleteData(0, letter.length);
            if (first.length == 0) first.remove();
        }
        else
        {
            box.text.appendChild(first);
        }
        if (box.hide.childNodes.length == 0)
        {
            box.text.removeAttribute("data-furigana-skip");
            Furigana.schedule(box.text);
        }
        box.textTimer = 0;
    }

    upadteScroll()
    {
        if (globalSystem.uiManager.window.isScrolling)
        {
            this.cancelScroll();
        }

        if (this.requireScroll == false)
        {
            return;
        }

        var speed = this.textarea.clientHeight * 5.0;
        var diff = this.textarea.scrollHeight - (this.textarea.clientHeight + this.textarea.scrollTop);
        if (diff < this.scrollThreshold)
        {
            var min = this.textarea.clientHeight * 0.1;
            var acc = this.textarea.clientHeight * 4.0;
            speed = min + (diff / this.scrollThreshold) * acc;

            var maxSpeed = this.textarea.clientHeight * 1.5;
            if (speed > maxSpeed)
            {
                speed = maxSpeed;
            }
        }

        var next = this.textarea.scrollTop + (globalSystem.time.deltaTime * speed);
        this.textarea.scrollTop = next;
        var bottom = this.textarea.scrollHeight - this.textarea.clientHeight;
        if (next >= bottom)
        {
            this.cancelScroll();
        }
    }

    setState(state)
    {
        if (this.currentState == state)
        {
            return;
        }

        this.currentState = state;
        var index = Number(state);
        for (var i = 0; i < this.waitSymbols.length; i++)
        {
            if (i == index)
            {
                this.waitSymbols[i].style.display = "inline";
            }
            else
            {
                this.waitSymbols[i].style.display = "none";
            }
        }
    }

    setTextWaitTime(index)
    {
        if (index >= TextLine.textWaitTimes.length)
        {
            return;
        }

        var time = TextLine.textWaitTimes[index];
        this.textWaitTime = time;
        this.textWaitTimeIndex = index;
    }

    switchTextWaitTime()
    {
        var index = this.textWaitTimeIndex + 1;
        if (index >= TextLine.textWaitTimes.length)
        {
            index = 0;
        }

        this.setTextWaitTime(index);
    }

    getCurrentTextWaitType()
    {
        var id = `textWait_${this.textWaitTimeIndex}`;
        var result = Terminology.get(id);
        return result;
    }

    skipTextAnimation()
    {
        var box = this.animationBox[0];
        var length = box.hide.innerHTML.length;
        for (var i = 0; i < length; i++)
        {
            this.updateText(box);
        }
    }

    writeLine(text, name = null, color = null, skippable = false)
    {
        if (this.textarea == null)
        {
            return;
        }

        text = Tag.replace(text, this.index);
        this.queue.push({ text: text, name: name, color: color, skippable: skippable });
    }

    writeInput(text)
    {
        if (text == null)
        {
            return;
        }

        var period = Terminology.get("input_period");
        for (var symbol of TextLine.periodSymbols)
        {
            if (text.endsWith(symbol))
            {
                period = StringExtension.empty;
                break;
            }
        }
        text = `${Terminology.get("input_symbol")}${text}${period}`;
        this.writeLine(text, null, Color.darkGreen);
    }

    reset()
    {
        this.textarea.innerHTML = "";
        this.queue = [];
        this.animationBox = [];
        this.currentTag = null;
        this.setVisible(true);
        this.cancelScroll();
    }

    setVisible(visible)
    {
        this.visible = visible;
    }

    fadeIn(time)
    {
        if (this.textarea == null)
        {
            return;
        }
        var opacity = Number(this.textarea.style.opacity);
        this.animator.opacity(this.textarea, opacity, 1, time, "ease-out");
    }

    fadeOut(time)
    {
        if (this.textarea == null)
        {
            return;
        }
        var opacity = Number(this.textarea.style.opacity);
        this.animator.opacity(this.textarea, opacity, 0, time, "ease-out");
    }

    notifyNext()
    {
        if (this.animationBox.length == 0)
        {
            return;
        }

        /*
        if (this.isScrollBottom == false && this.isForceScrollBottom == false)
        {
            return;
        }
        */
        if (this.isScrollBottom == false)
        {
            this.isForceScrollBottom = true;
        }

        var box = this.animationBox[0];
        if (box.hide.innerHTML.length == 0)
        {
            box.bgTimer = 0;
            this.updateBoxAnimation();
            this.animationBox = List.remove(this.animationBox, box);
        }
        else
        {
            this.skipTextAnimation();
            this.updateBoxAnimation();
        }
    }

    cancelScroll()
    {
        this.requireScroll = false;
        this.isForceScrollBottom = false;
    }

    forceScrollBottom()
    {
        this.isForceScrollBottom = true;
        this.notifyNext();
    }

    onClickButton(event, element)
    {
        var text = Furigana.plainText(element);
        globalSystem.uiManager.textInput[this.index].setInput(text);
        if (event != null)
        {
            event.stopPropagation();
        }
        if (element != null)
        {
            element.blur();
        }
    }

    onContextMenuButton(event, element)
    {
        var text = Furigana.plainText(element);
        var index = 0;
        if (this.index == 0)
        {
            index = 1;
        }
        globalSystem.uiManager.textInput[index].setInput(text);
        return false;
    }
}

new TextLine(0);
new TextLine(1);
