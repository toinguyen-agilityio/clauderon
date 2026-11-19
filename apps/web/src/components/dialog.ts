import type { PointerEvent, MouseEvent } from "react";

/**
 * Spread on a `<dialog className="modal">` to close it when the backdrop is clicked.
 * `.modal` has no padding and `.modal-in` fills it, so a click whose target is the
 * dialog itself landed on the backdrop. The press must also start there, so a text
 * selection dragged out of the dialog does not close it.
 */
export const closeOnBackdrop = {
  onPointerDown(event: PointerEvent<HTMLDialogElement>) {
    event.currentTarget.dataset.backdropPress = event.target === event.currentTarget ? "1" : "";
  },
  onClick(event: MouseEvent<HTMLDialogElement>) {
    const dialog = event.currentTarget;
    const pressed = dialog.dataset.backdropPress === "1";
    dialog.dataset.backdropPress = "";
    if (pressed && event.target === dialog) dialog.close();
  },
};
