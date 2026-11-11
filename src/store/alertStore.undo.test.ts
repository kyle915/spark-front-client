import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  flushPendingUndoables,
  pendingUndoableCount,
  useAlertStore,
} from "./alertStore";

describe("undoable alerts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAlertStore.setState({ alerts: [] });
  });
  afterEach(() => {
    flushPendingUndoables();
    vi.useRealTimers();
  });

  it("holds the action until the window closes", () => {
    const run = vi.fn();
    useAlertStore
      .getState()
      .showUndoable("Approving 3", run, { durationMs: 6000 });
    expect(run).not.toHaveBeenCalled();
    expect(useAlertStore.getState().alerts).toHaveLength(1);
    vi.advanceTimersByTime(5999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(useAlertStore.getState().alerts).toHaveLength(0);
  });

  it("undo cancels it for good", () => {
    const run = vi.fn();
    const onUndo = vi.fn();
    const id = useAlertStore
      .getState()
      .showUndoable("Approving 3", run, { durationMs: 6000, onUndo });
    expect(useAlertStore.getState().undo(id)).toBe(true);
    expect(onUndo).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(run).not.toHaveBeenCalled();
    expect(useAlertStore.getState().alerts).toHaveLength(0);
    expect(useAlertStore.getState().undo(id)).toBe(false);
  });

  it("dismissing the toast does not cancel or hide a held action", () => {
    const run = vi.fn();
    const id = useAlertStore
      .getState()
      .showUndoable("Approving 3", run, { durationMs: 6000 });
    useAlertStore.getState().removeAlert(id);
    expect(useAlertStore.getState().alerts).toHaveLength(1);
    vi.advanceTimersByTime(6000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs held actions when the page leaves", () => {
    const a = vi.fn();
    const b = vi.fn();
    useAlertStore.getState().showUndoable("A", a);
    useAlertStore.getState().showUndoable("B", b);
    expect(pendingUndoableCount()).toBe(2);
    flushPendingUndoables();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(pendingUndoableCount()).toBe(0);
  });

  it("gives two alerts raised together different ids", () => {
    const s = useAlertStore.getState();
    const x = s.showUndoable("x", () => {});
    const y = s.showUndoable("y", () => {});
    expect(x).not.toBe(y);
  });
});
