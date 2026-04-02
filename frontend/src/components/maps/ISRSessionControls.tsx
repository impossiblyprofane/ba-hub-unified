// ══════════════════════════════════════════════════════════════
// ISR Session Controls — collaborative session UI
//
// Compact floating panel for starting, joining, and managing
// collaborative drawing sessions.
// ══════════════════════════════════════════════════════════════

import { component$, useSignal, type PropFunction, type Signal } from '@builder.io/qwik';
import { useI18n, t } from '~/lib/i18n';
import type { SessionMode, SessionUser } from '~/lib/maps/types';

// ── Props ──

interface ISRSessionControlsProps {
  sessionMode: Signal<SessionMode>;
  sessionId: Signal<string | null>;
  sessionUsers: Signal<SessionUser[]>;
  connectionStatus: Signal<'disconnected' | 'connecting' | 'connected'>;
  localUserName: Signal<string>;
  localClientId: Signal<number>;
  onStartSession$: PropFunction<() => void>;
  onJoinSession$: PropFunction<(id: string) => void>;
  onLeaveSession$: PropFunction<() => void>;
  onSetUserName$: PropFunction<(name: string) => void>;
}

// ── Connection status indicator ──

const StatusDot = component$<{ status: 'disconnected' | 'connecting' | 'connected' }>(({ status }) => {
  const color =
    status === 'connected' ? 'bg-[var(--green)]' :
    status === 'connecting' ? 'bg-[var(--amber)]' :
    'bg-[var(--red)]';
  const pulse = status === 'connecting' ? 'animate-pulse' : '';
  return <span class={`inline-block w-2 h-2 rounded-full ${color} ${pulse}`} />;
});

// ══════════════════════════════════════════════════════════════

export const ISRSessionControls = component$<ISRSessionControlsProps>((props) => {
  const i18n = useI18n();
  const joinInput = useSignal('');
  const copied = useSignal(false);
  const editingName = useSignal(false);
  const nameInput = useSignal('');
  const showJoin = useSignal(false);

  const isLocal = props.sessionMode.value === 'local';

  return (
    <div class="bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)] min-w-[200px]">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-[rgba(51,51,51,0.3)]">
        <span class="font-mono tracking-[0.3em] uppercase text-[var(--text-dim)] text-[10px]">
          {isLocal ? t(i18n, 'maps.session.local') : t(i18n, 'maps.session.collaborative')}
        </span>
        {!isLocal && (
          <StatusDot status={props.connectionStatus.value} />
        )}
      </div>

      <div class="px-3 py-2 space-y-2">
        {isLocal ? (
          // ── Local mode: Start or Join ──
          <>
            <button
              class="w-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider
                     border border-[var(--accent)] text-[var(--accent)]
                     hover:bg-[rgba(70,151,195,0.1)] transition-colors"
              onClick$={props.onStartSession$}
            >
              {t(i18n, 'maps.session.start')}
            </button>

            {!showJoin.value ? (
              <button
                class="w-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider
                       border border-[rgba(51,51,51,0.3)] text-[var(--text-dim)]
                       hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                onClick$={() => { showJoin.value = true; }}
              >
                {t(i18n, 'maps.session.join')}
              </button>
            ) : (
              <div class="flex gap-1">
                <input
                  type="text"
                  class="flex-1 px-2 py-1 text-[10px] font-mono bg-[rgba(26,26,26,0.4)]
                         border border-[var(--border)] text-[var(--text)]
                         placeholder:text-[var(--text-dim)] focus:border-[var(--accent)] outline-none"
                  placeholder={t(i18n, 'maps.session.enterCode')}
                  maxLength={8}
                  value={joinInput.value}
                  onInput$={(e) => {
                    joinInput.value = (e.target as HTMLInputElement).value;
                  }}
                  onKeyDown$={(e) => {
                    if (e.key === 'Enter' && joinInput.value.length >= 6) {
                      props.onJoinSession$(joinInput.value);
                      joinInput.value = '';
                      showJoin.value = false;
                    }
                    if (e.key === 'Escape') {
                      showJoin.value = false;
                    }
                  }}
                />
                <button
                  class="px-2 py-1 text-[10px] font-mono text-[var(--accent)]
                         border border-[var(--accent)] hover:bg-[rgba(70,151,195,0.1)]
                         transition-colors disabled:opacity-30"
                  disabled={joinInput.value.length < 6}
                  onClick$={() => {
                    if (joinInput.value.length >= 6) {
                      props.onJoinSession$(joinInput.value);
                      joinInput.value = '';
                      showJoin.value = false;
                    }
                  }}
                >
                  OK
                </button>
              </div>
            )}
          </>
        ) : (
          // ── Collaborative mode ──
          <>
            {/* Session ID with copy */}
            <div class="flex items-center justify-between">
              <span class="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
                {t(i18n, 'maps.session.sessionId')}
              </span>
              <div class="flex items-center gap-1.5">
                <code class="text-[11px] font-mono text-[var(--accent)] tracking-wider select-all">
                  {props.sessionId.value}
                </code>
                <button
                  class="text-[9px] font-mono text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
                  onClick$={async () => {
                    if (props.sessionId.value) {
                      await navigator.clipboard.writeText(props.sessionId.value);
                      copied.value = true;
                      setTimeout(() => { copied.value = false; }, 2000);
                    }
                  }}
                >
                  {copied.value ? t(i18n, 'maps.session.copied') : '📋'}
                </button>
              </div>
            </div>

            {/* Connection status */}
            <div class="flex items-center gap-1.5 text-[9px] font-mono text-[var(--text-dim)]">
              <StatusDot status={props.connectionStatus.value} />
              <span>
                {props.connectionStatus.value === 'connected' && t(i18n, 'maps.session.connected')}
                {props.connectionStatus.value === 'connecting' && t(i18n, 'maps.session.connecting')}
                {props.connectionStatus.value === 'disconnected' && t(i18n, 'maps.session.disconnected')}
              </span>
            </div>

            {/* User list */}
            {props.sessionUsers.value.length > 0 && (
              <div class="space-y-1">
                <span class="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
                  {t(i18n, 'maps.session.users')} ({props.sessionUsers.value.length})
                </span>
                <div class="space-y-0.5">
                  {props.sessionUsers.value.map((user) => {
                    const isLocal = user.clientId === props.localClientId.value;
                    return (
                      <div key={user.clientId} class="flex items-center gap-1.5 text-[10px] font-mono">
                        <span
                          class="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: user.color }}
                        />
                        {isLocal && editingName.value ? (
                          <input
                            type="text"
                            class="flex-1 px-1 py-0 text-[10px] font-mono bg-[rgba(26,26,26,0.4)]
                                   border border-[var(--accent)] text-[var(--text)] outline-none"
                            value={nameInput.value}
                            onInput$={(e) => {
                              nameInput.value = (e.target as HTMLInputElement).value;
                            }}
                            onKeyDown$={(e) => {
                              if (e.key === 'Enter') {
                                props.onSetUserName$(nameInput.value || 'Anonymous');
                                editingName.value = false;
                              }
                              if (e.key === 'Escape') {
                                editingName.value = false;
                              }
                            }}
                            onBlur$={() => {
                              if (editingName.value) {
                                props.onSetUserName$(nameInput.value || 'Anonymous');
                                editingName.value = false;
                              }
                            }}
                          />
                        ) : (
                          <span
                            class={`text-[var(--text)] ${isLocal ? 'cursor-pointer hover:text-[var(--accent)]' : ''}`}
                            title={isLocal ? t(i18n, 'maps.session.editName') : undefined}
                            onClick$={() => {
                              if (isLocal) {
                                nameInput.value = user.name;
                                editingName.value = true;
                              }
                            }}
                          >
                            {user.name}
                          </span>
                        )}
                        {user.isHost && (
                          <span class="text-[8px] text-[var(--accent)] px-1 border border-[rgba(70,151,195,0.3)]">
                            {t(i18n, 'maps.session.host')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Leave button */}
            <button
              class="w-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider
                     border border-[var(--red)] text-[var(--red)]
                     hover:bg-[rgba(231,76,60,0.1)] transition-colors"
              onClick$={props.onLeaveSession$}
            >
              {t(i18n, 'maps.session.leave')}
            </button>
          </>
        )}
      </div>
    </div>
  );
});
