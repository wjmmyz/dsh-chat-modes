/**
 * Chat-mode shell fence.
 *
 * Both Chat presets (`chat`, `chat-whale`) declare no shell row, yet the host
 * plane registers some tools globally — `win_bash` among them — and a global
 * registration is visible to EVERY agent no matter which preset composed it.
 * A Chat-mode model then reads a shell in its tool list, calls it because it
 * looks available, and gets a refusal (or, in a full-access session, an actual
 * shell). A mode whose whole promise is "no terminal" must not advertise one.
 *
 * This row is mounted INSIDE those presets, so `ctx.tools.restrict()` files the
 * denial into the preset's own tool layer: every agent composed from that
 * preset inherits it, and no other mode is touched. The denial is deny-only and
 * name-based, so a deployment that registers none of these names costs nothing
 * and an upstream rename degrades to "no denial" instead of a broken mode.
 */

/**
 * Global tool names withheld from Chat-mode agents.
 *
 * Only tools the HOST plane registers belong here. A tool a preset declares
 * itself is already scoped to that preset, so it needs no fence — and denying
 * an unregistered name throws, which is why the list is filtered below.
 */
const FENCED_TOOLS = [
  'win_bash',
  'bash',
  'pwsh',
  'bash_persistent',
  'pwsh_persistent',
  'persistent_bash',
  'persistent_pwsh',
];

/** The tool registry this row needs before it can fence anything. */
export const inject = ['tools'];

/**
 * Log one diagnostic without failing the composition.
 * @param ctx - the plugin context.
 * @param message - the line to record.
 */
function warn(ctx, message) {
  try {
    ctx.logger?.warn?.(message);
  } catch {
    // A missing logger must not break the fence.
  }
}

/**
 * Names from {@link FENCED_TOOLS} that this scope can still see.
 *
 * `restrict()` rejects a name the registry does not know, and "not registered
 * yet" is an ordinary boot state here, so the list is resolved against the
 * current view on every attempt.
 * @param ctx - the plugin context.
 * @returns the deniable names, possibly empty.
 */
function deniableNames(ctx) {
  const tools = ctx.get('tools');
  if (tools === undefined || typeof tools.definitions !== 'function') return [];
  let definitions;
  try {
    definitions = tools.definitions();
  } catch {
    return [];
  }
  if (!Array.isArray(definitions)) return [];
  const known = new Set(definitions.map(entry => entry?.name).filter(entry => typeof entry === 'string'));
  return FENCED_TOOLS.filter(toolName => known.has(toolName));
}

/**
 * Install the fence for one Chat preset.
 * @param ctx - the plugin context, mounted inside the preset.
 */
export function apply(ctx) {
  /** The disposer of the installed restriction, once it lands. */
  let dispose;

  /**
   * Try to fence now; a name that is not registered yet is retried off
   * `tools/change` rather than reported as a defect.
   */
  const fence = () => {
    if (dispose !== undefined) return;
    const deny = deniableNames(ctx);
    if (deny.length === 0) return;
    const restrict = ctx.tools?.restrict;
    if (typeof restrict !== 'function') return;
    try {
      const installed = restrict.call(ctx.tools, { deny });
      if (typeof installed === 'function') dispose = installed;
    } catch (error) {
      warn(ctx, 'chat-mode: the shell fence could not be installed: ' + String(error?.message ?? error));
    }
  };

  fence();
  ctx.on('tools/change', fence);

  ctx.effect(() => () => {
    const installed = dispose;
    dispose = undefined;
    if (typeof installed !== 'function') return;
    try {
      installed();
    } catch {
      // The owning scope is going away anyway.
    }
  }, 'chat-mode: shell fence');
}
