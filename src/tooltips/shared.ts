import {
    autoUpdate,
    computePosition,
    offset,
    shift,
    flip,
    arrow,
    type Placement,
} from "@floating-ui/dom";
import { noChange } from "lit";
import { directive, Directive, ElementPart, Part, PartInfo, PartType } from "lit/directive.js";

export type TooltipInstance = {
    tooltip: HTMLElement;
    content: HTMLElement;
    target: HTMLElement;
};

type Params = {
    placement: Placement;
    showDelay: number;
    hideDelay: number;
    interactive: boolean;
    className: string;
    containerName: string;
};

function tooltipGenerator(params: Partial<Params>) {
    const fullParams: Params = {
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

    let container: HTMLElement | null = null;
    let tooltip: HTMLElement | null = null;
    let closingTimer: number | null = null;
    let destroy: Function | null = null;

    function hide() {
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }
        if (destroy) {
            destroy();
            destroy = null;
        }
    }

    function startHiding() {
        if (fullParams.hideDelay) {
            closingTimer = setTimeout(hide, 200);
        } else {
            hide();
        }
    }

    function cancelHiding() {
        if (!closingTimer) return;
        clearTimeout(closingTimer);
        closingTimer = null;
    }

    async function show(elem: HTMLElement, contentProvider: (tip: TooltipInstance) => void) {
        hide();
        let canceled = false;
        // Do delay if needed
        if (fullParams.showDelay) {
            elem.addEventListener(
                "mouseleave",
                () => {
                    canceled = true;
                },
                { once: true },
            );
            await new Promise((res) => {
                setTimeout(res, fullParams.showDelay);
            });
            if (canceled) return;
        }

        // Create the tooltip and add the content
        tooltip = document.createElement("div");
        tooltip.className = fullParams.className;
        tooltip.innerHTML = `<div class="${fullParams.className}-content"></div>`;

        // Add the tooltip content
        await contentProvider({
            tooltip,
            content: tooltip.firstElementChild as HTMLElement,
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
        const stop = autoUpdate(elem, tooltip, () => {
            if (!tooltip || !document.contains(elem)) {
                hide();
                return;
            }
            computePosition(elem, tooltip, {
                placement: fullParams.placement,
                middleware: [offset(8), shift(), flip(), arrow({ element: arrowElem })],
            }).then(({ x, y, placement, middlewareData }) => {
                if (!tooltip) return;
                tooltip.style.left = `${x}px`;
                tooltip.style.top = `${y}px`;
                tooltip.dataset.placement = placement;
                arrowElem.style.left = `${middlewareData.arrow?.x}px`;
                arrowElem.style.top = `${middlewareData.arrow?.y}px`;
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

    function attach(elem: HTMLElement, content: (tip: TooltipInstance) => void) {
        elem.addEventListener("mouseenter", () => {
            show(elem, content);
        });
    }

    return attach;
}

export const addTooltip = tooltipGenerator({
    showDelay: 500,
    hideDelay: 250,
    interactive: true,
    className: "tpt-tip",
    containerName: "tpt-tips",
});

class TooltipDirective extends Directive {
    constructor(partInfo: PartInfo) {
        super(partInfo);
        if (partInfo.type !== PartType.ELEMENT) throw new Error("Wrong place");
    }

    attached = false;

    update(part: Part, props: [(tip: TooltipInstance) => void]) {
        addTooltip((part as ElementPart).element as HTMLElement, props[0]);
        return this.render(props[0]);
    }

    render(_content: (tip: TooltipInstance) => void) {
        return noChange;
    }
}

/** Lit directive for attaching a tooltip */
export const tooltip = directive(TooltipDirective);
