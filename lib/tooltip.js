"use strict";

/* globals FloatingUIDOM */

// eslint-disable-next-line no-unused-vars
function tooltipGenerator (params) {
    const fullParams = {
        placement: "top",
        showDelay: 0,
        hideDelay: 0,
        interactive: false,
        className: "tooltip",
        containerName: "tooltips",
        ...params,
    };

    const arrowElem = document.createElement("div");
    arrowElem.className = "arrow";

    let container = null;
    let tooltip = null;
    let closingTimer = null;
    let destroy = null;

    function hide () {
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }
        if (destroy) {
            destroy();
            destroy = null;
        }
    }

    function startHiding () {
        if (fullParams.hideDelay) {
            closingTimer = setTimeout(hide, 200);
        } else {
            hide();
        }
    }

    function cancelHiding () {
        if (!closingTimer) return;
        clearTimeout(closingTimer);
        closingTimer = null;
    }

    async function show (elem, contentProvider) {
        hide();
        let canceled = false;
        // Do delay if needed
        if (fullParams.showDelay) {
            elem.addEventListener("mouseleave", () => { canceled = true; }, { once: true });
            await new Promise((res) => { setTimeout(res, fullParams.showDelay); });
            if (canceled) return;
        }

        // Create the tooltip and add the content
        tooltip = document.createElement("div");
        tooltip.className = fullParams.className;
        tooltip.innerHTML = `<div class="${fullParams.className}-content"></div>`;

        // Add the tooltip content
        await contentProvider({
            tooltip,
            content: tooltip.firstElementChild,
            target: elem,
        });
        tooltip.prepend(arrowElem);

        // Ensure the tooltip still need to be shown
        if (canceled || !document.contains(elem)) return;

        if (fullParams.interactive) {
            tooltip.addEventListener("mouseleave", startHiding);
            tooltip.addEventListener("mouseenter", cancelHiding);
        }

        if (!container) {
            container = document.createElement("div");
            container.id = fullParams.containerName;
            document.body.append(container);
        }
        container.append(tooltip);
        // Display the tooltip
        const stop = FloatingUIDOM.autoUpdate(elem, tooltip, () => {
            if (!document.contains(elem)) {
                hide();
                return;
            }
            FloatingUIDOM.computePosition(elem, tooltip, {
                placement: fullParams.placement,
                middleware: [
                    FloatingUIDOM.offset(8),
                    FloatingUIDOM.shift(),
                    FloatingUIDOM.flip(),
                    FloatingUIDOM.arrow({ element: arrowElem }),
                ],
            }).then(({
                x, y, placement, middlewareData,
            }) => {
                tooltip.style.left = `${x}px`;
                tooltip.style.top = `${y}px`;
                tooltip.dataset.placement = placement;
                arrowElem.style.left = `${middlewareData.arrow.x}px`;
                arrowElem.style.top = `${middlewareData.arrow.y}px`;
            });
        });
        // Listeners to hide the tooltip
        elem.addEventListener("mouseleave", startHiding);
        elem.addEventListener("mouseenter", cancelHiding);
        elem.addEventListener("click", hide);
        destroy = () => {
            elem.removeEventListener("mouseleave", startHiding);
            elem.removeEventListener("mouseenter", cancelHiding);
            elem.removeEventListener("click", hide);
            stop();
        };
    }

    function attach (elem, content) {
        elem.addEventListener("mouseenter", () => {
            show(elem, content);
        });
    }

    return attach;
}
