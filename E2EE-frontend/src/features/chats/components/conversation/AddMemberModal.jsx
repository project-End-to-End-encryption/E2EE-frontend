import React, { useMemo, useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import Avatar from '../../../../components/common/Avatar.jsx';
import { useUserSearch } from '../../hooks/useUserSearch.js';
import { conversationService } from '../../../conversation/service/conversationService.js';
import { messageFor } from '../../../../shared/constants/errorCodes.js';

export default function AddMemberModal({ isOpen, onClose, conversationId, existingMemberIds = [] }) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(new Map());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const search = useUserSearch(query, { enabled: isOpen });
    const selectedList = useMemo(() => Array.from(selected.values()), [selected]);
    const existing = useMemo(() => new Set(existingMemberIds.map(String)), [existingMemberIds]);

    if (!isOpen) return null;

    const toggleUser = (user) => {
        setSelected((prev) => {
            const next = new Map(prev);
            next.has(user.userId) ? next.delete(user.userId) : next.set(user.userId, user);
            return next;
        });
    };

    const handleClose = () => { setQuery(''); setSelected(new Map()); setError(null); onClose(); };

    // One backend call per pick — CONVERSATION_ADD_MEMBER takes a single
    // newUserId. Each success independently triggers groupMembershipSync on
    // every device, which hands that one newcomer the sender key.
    const handleAdd = async () => {
        if (!selectedList.length || saving) return;
        setSaving(true); setError(null);
        const results = await Promise.allSettled(
            selectedList.map((u) => conversationService.addMember(conversationId, u.userId))
        );
        setSaving(false);
        const failed = results.find((r) => r.status === 'rejected');
        if (failed) { setError(failed.reason); return; }
        handleClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={handleClose}>
            <div className="w-full max-w-[420px] max-h-[80vh] flex flex-col bg-[var(--surface)] rounded-[20px] border border-[var(--line)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
                    <h2 className="m-0 font-semibold text-[17px] text-[var(--ink)]">Add members</h2>
                    <button type="button" onClick={handleClose} className="inline-flex items-center justify-center w-9 h-9 p-0 border-0 rounded-[12px] bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)]">
                        <X className="w-[20px] h-[20px]" />
                    </button>
                </div>

                <div className="px-5 py-3">
                    <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…"
                           className="w-full px-4 py-2 rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[15px] text-[var(--ink)] outline-none focus:border-[var(--accent)]" />
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2">
                    {(search.users ?? []).filter((u) => !existing.has(String(u.userId))).map((user) => {
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
                </div>

                {error && <p className="mx-5 mb-3 px-3 py-2 rounded-[12px] bg-[var(--danger-soft)] text-[var(--danger)] font-medium text-[13px]" role="alert">{messageFor(error)}</p>}

                <div className="px-5 py-4 border-t border-[var(--line)]">
                    <button type="button" disabled={!selectedList.length || saving} onClick={handleAdd}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border-0 rounded-full font-semibold text-[15px] bg-[var(--accent)] text-white disabled:opacity-40 hover:bg-[var(--accent-hover)]">
                        {saving && <Loader2 className="w-[16px] h-[16px] animate-spin" />}
                        Add {selectedList.length > 0 ? `(${selectedList.length})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}