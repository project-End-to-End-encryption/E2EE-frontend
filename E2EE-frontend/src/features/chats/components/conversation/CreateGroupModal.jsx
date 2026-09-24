import React, { useMemo, useState } from 'react';
import { X, Check, ArrowLeft, Loader2 } from 'lucide-react';
import Avatar from '../../../../components/common/Avatar.jsx';
import { useUserSearch } from '../../hooks/useUserSearch.js';
import { conversationService } from '../../../conversation/service/conversationService.js';
import { messageFor } from '../../../../shared/constants/errorCodes.js';

export default function CreateGroupModal({ isOpen, onClose, onCreated }) {
    const [step, setStep] = useState('members'); // 'members' | 'name'
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(new Map()); // userId -> user
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);

    const search = useUserSearch(query, { enabled: isOpen && step === 'members' });
    const selectedList = useMemo(() => Array.from(selected.values()), [selected]);

    if (!isOpen) return null;

    const toggleUser = (user) => {
        setSelected((prev) => {
            const next = new Map(prev);
            next.has(user.userId) ? next.delete(user.userId) : next.set(user.userId, user);
            return next;
        });
    };

    const reset = () => { setStep('members'); setQuery(''); setSelected(new Map()); setName(''); setError(null); };
    const handleClose = () => { reset(); onClose(); };

    const handleCreate = async () => {
        if (!name.trim() || !selectedList.length || creating) return;
        setCreating(true); setError(null);
        try {
            const { conversationId } = await conversationService.createGroup(
                name.trim(), selectedList.map((u) => u.userId), null
            );
            reset();
            onCreated?.(conversationId);
        } catch (err) {
            setError(err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={handleClose}>
            <div className="w-full max-w-[420px] max-h-[80vh] flex flex-col bg-[var(--surface)] rounded-[20px] border border-[var(--line)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
                    <div className="flex items-center gap-2">
                        {step === 'name' && (
                            <button type="button" onClick={() => setStep('members')} className="inline-flex items-center justify-center w-8 h-8 p-0 border-0 rounded-[10px] bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)]">
                                <ArrowLeft className="w-[18px] h-[18px]" />
                            </button>
                        )}
                        <h2 className="m-0 font-semibold text-[17px] text-[var(--ink)]">
                            {step === 'members' ? 'Add members' : 'Name your group'}
                        </h2>
                    </div>
                    <button type="button" onClick={handleClose} className="inline-flex items-center justify-center w-9 h-9 p-0 border-0 rounded-[12px] bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)]">
                        <X className="w-[20px] h-[20px]" />
                    </button>
                </div>

                {step === 'members' ? (
                    <>
                        {selectedList.length > 0 && (
                            <div className="flex gap-2 px-5 py-3 overflow-x-auto border-b border-[var(--line)]">
                                {selectedList.map((user) => (
                                    <button key={user.userId} type="button" onClick={() => toggleUser(user)} className="flex flex-col items-center gap-1 w-[56px] shrink-0 border-0 bg-transparent">
                                        <span className="relative">
                                            <Avatar name={user.fullName || user.username} seed={user.userId} profilePictureKey={user.profilePictureKey} size={44} />
                                            <span className="absolute -top-1 -right-1 flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[var(--danger)] text-white"><X className="w-[12px] h-[12px]" /></span>
                                        </span>
                                        <span className="text-[11px] text-[var(--ink-2)] truncate w-full text-center">{user.fullName || user.username}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="px-5 py-3">
                            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…"
                                   className="w-full px-4 py-2 rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[15px] text-[var(--ink)] outline-none focus:border-[var(--accent)]" />
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 pb-2">
                            {search.status === 'error' && <p className="px-3 py-2 text-[13px] text-[var(--danger)]">{search.errorMessage}</p>}
                            {(search.users ?? []).map((user) => {
                                const checked = selected.has(user.userId);
                                return (
                                    <button key={user.userId} type="button" onClick={() => toggleUser(user)} className="flex items-center gap-3 w-full px-3 py-2 border-0 rounded-[12px] bg-transparent hover:bg-[var(--surface-2)] text-left">
                                        <Avatar name={user.fullName || user.username} seed={user.userId} profilePictureKey={user.profilePictureKey} size={40} />
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-medium text-[14px] text-[var(--ink)] truncate">{user.fullName || user.username}</span>
                                            {user.username && <span className="block text-[12px] text-[var(--ink-3)] truncate">@{user.username}</span>}
                                        </span>
                                        <span className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-full border-2 ${checked ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--line)]'}`}>
                                            {checked && <Check className="w-[14px] h-[14px] text-white" />}
                                        </span>
                                    </button>
                                );
                            })}
                            {query.trim() && search.status !== 'loading' && (search.users ?? []).length === 0 && (
                                <p className="px-3 py-6 text-center text-[13px] text-[var(--ink-3)]">No people found</p>
                            )}
                        </div>

                        <div className="px-5 py-4 border-t border-[var(--line)]">
                            <button type="button" disabled={!selectedList.length} onClick={() => setStep('name')}
                                    className="w-full inline-flex items-center justify-center px-4 py-2 border-0 rounded-full font-semibold text-[15px] bg-[var(--accent)] text-white disabled:opacity-40 hover:bg-[var(--accent-hover)]">
                                Next {selectedList.length > 0 ? `(${selectedList.length})` : ''}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col items-center gap-3 px-5 py-6">
                            <Avatar name={name || 'Group'} seed="new-group" group size={88} />
                            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" maxLength={80}
                                   className="w-full px-4 py-2 rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[15px] text-[var(--ink)] text-center outline-none focus:border-[var(--accent)]" />
                            <p className="m-0 text-[13px] text-[var(--ink-3)]">{selectedList.length} member{selectedList.length === 1 ? '' : 's'}</p>
                        </div>

                        {error && <p className="mx-5 mb-3 px-3 py-2 rounded-[12px] bg-[var(--danger-soft)] text-[var(--danger)] font-medium text-[13px]" role="alert">{messageFor(error)}</p>}

                        <div className="px-5 py-4 border-t border-[var(--line)]">
                            <button type="button" disabled={!name.trim() || creating} onClick={handleCreate}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border-0 rounded-full font-semibold text-[15px] bg-[var(--accent)] text-white disabled:opacity-40 hover:bg-[var(--accent-hover)]">
                                {creating && <Loader2 className="w-[16px] h-[16px] animate-spin" />}
                                Create group
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}