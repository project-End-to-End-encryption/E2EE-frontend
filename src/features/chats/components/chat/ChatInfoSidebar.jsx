import React, { useEffect, useMemo, useState } from 'react';
import { X, Image, FileText, Video, UserPlus, LogOut, Loader2 } from 'lucide-react';
import Avatar from '../../../../components/common/Avatar.jsx';
import { userDirectory } from '../../../user/service/userDirectory.js';
import { authStore } from '../../../auth/storage/authStore.js';
import { conversationService } from '../../../conversation/service/conversationService.js';
import { messageFor } from '../../../../shared/constants/errorCodes.js';
import AddMemberModal from '../conversation/AddMemberModal.jsx';

export default function ChatInfoSidebar({ isOpen, onClose, conversation, onLeft }) {
    const [profiles, setProfiles] = useState({});
    const [showAddMember, setShowAddMember] = useState(false);
    const [busyUserId, setBusyUserId] = useState(null);
    const [actionError, setActionError] = useState(null);

    const isGroup = conversation?.type === 'group';
    const name = conversation?.displayName || 'Conversation';
    const peer = conversation?.peer;
    const selfId = safeSelfId();

    // `members` (id + role) only exists on rows synced via create/add/remove
    // acks. Older cached rows may only have memberIds — degrade to role
    // 'member' for everyone rather than breaking.
    const members = useMemo(() => {
        if (conversation?.members?.length) return conversation.members;
        return (conversation?.memberIds ?? []).map((userId) => ({ userId, role: 'member' }));
    }, [conversation]);

    const myRole = members.find((m) => String(m.userId) === String(selfId))?.role;
    const canManage = myRole === 'owner' || myRole === 'admin';

    useEffect(() => {
        if (!isGroup || !isOpen || !members.length) return;
        const ids = members.map((m) => String(m.userId)).filter((id) => id !== String(selfId));
        if (!ids.length) return;

        let cancelled = false;
        userDirectory.profiles(ids).then(() => {
            if (cancelled) return;
            setProfiles(Object.fromEntries(ids.map((id) => [id, userDirectory.cached(id)])));
        });
        return () => { cancelled = true; };
    }, [isGroup, isOpen, members, selfId]);

    if (!isOpen) return null;

    const nameFor = (userId) => {
        if (String(userId) === String(selfId)) return 'You';
        const profile = profiles[String(userId)];
        return profile?.fullName || (profile?.username ? `@${profile.username}` : 'Member');
    };

    const handleRemove = async (targetUserId) => {
        setBusyUserId(targetUserId);
        setActionError(null);
        try {
            await conversationService.removeMember(conversation._id, targetUserId);
            if (String(targetUserId) === String(selfId)) {
                onClose();
                onLeft?.(conversation._id);
            }
        } catch (error) {
            setActionError(error);
        } finally {
            setBusyUserId(null);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 bottom-0 w-full max-w-[400px] bg-[var(--surface)] border-l border-[var(--line)] z-50 overflow-y-auto">
                <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-[var(--glass-strong)] border-b border-[var(--line)]">
                    <h2 className="m-0 font-semibold text-[17px] text-[var(--ink)]">{isGroup ? 'Group Info' : 'Contact Info'}</h2>
                    <button type="button" onClick={onClose} className="inline-flex items-center justify-center w-9 h-9 p-0 border-0 rounded-[12px] bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)]">
                        <X className="w-[20px] h-[20px]" />
                    </button>
                </div>

                <div className="flex flex-col items-center gap-3 px-5 py-8 border-b border-[var(--line)]">
                    <Avatar name={name} seed={conversation?._id} profilePictureKey={peer?.profilePictureKey} group={isGroup} size={120} />
                    <div className="text-center">
                        <h3 className="m-0 mb-1 font-semibold text-[20px] text-[var(--ink)]">{name}</h3>
                        {!isGroup && peer?.username && <p className="m-0 text-[14px] text-[var(--ink-2)]">@{peer.username}</p>}
                        {isGroup && <p className="m-0 text-[14px] text-[var(--ink-2)]">{members.length} members</p>}
                    </div>
                </div>

                <div className="px-5 py-4 border-b border-[var(--line)]">
                    <h4 className="m-0 mb-3 font-semibold text-[14px] text-[var(--ink-2)] uppercase">Media & Files</h4>
                    <div className="grid grid-cols-3 gap-2">
                        <button type="button" className="aspect-square rounded-[12px] border-2 border-dashed border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center"><Image className="w-6 h-6" /></button>
                        <button type="button" className="aspect-square rounded-[12px] border-2 border-dashed border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center"><Video className="w-6 h-6" /></button>
                        <button type="button" className="aspect-square rounded-[12px] border-2 border-dashed border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center"><FileText className="w-6 h-6" /></button>
                    </div>
                    <p className="mt-3 text-[13px] text-[var(--ink-3)] text-center">No media yet</p>
                </div>

                {isGroup && (
                    <div className="px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="m-0 font-semibold text-[14px] text-[var(--ink-2)] uppercase">Members · {members.length}</h4>
                            <button type="button" onClick={() => setShowAddMember(true)}
                                    className="inline-flex items-center gap-1 px-2 py-1 border-0 rounded-[10px] bg-transparent text-[var(--accent)] font-semibold text-[13px] hover:bg-[var(--surface-2)]">
                                <UserPlus className="w-[15px] h-[15px]" /> Add
                            </button>
                        </div>

                        {actionError && <p className="mb-3 px-3 py-2 rounded-[12px] bg-[var(--danger-soft)] text-[var(--danger)] font-medium text-[13px]" role="alert">{messageFor(actionError)}</p>}

                        <ul className="m-0 p-0 list-none flex flex-col gap-1">
                            {members.map((member) => {
                                const isSelf = String(member.userId) === String(selfId);
                                const profile = isSelf ? null : profiles[String(member.userId)];
                                const busy = busyUserId === member.userId;
                                const canRemoveThis = isSelf || (canManage && member.role !== 'owner');

                                return (
                                    <li key={member.userId} className="flex items-center gap-3 px-2 py-2 rounded-[12px] hover:bg-[var(--surface-2)]">
                                        <Avatar name={nameFor(member.userId)} seed={member.userId} profilePictureKey={profile?.profilePictureKey} size={40} />
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-medium text-[14px] text-[var(--ink)] truncate">{nameFor(member.userId)}</span>
                                            {member.role === 'owner' && <span className="block text-[12px] text-[var(--accent)]">Owner</span>}
                                            {member.role === 'admin' && <span className="block text-[12px] text-[var(--ink-3)]">Admin</span>}
                                        </span>
                                        {canRemoveThis && (
                                            <button type="button" disabled={busy} onClick={() => handleRemove(member.userId)}
                                                    className="inline-flex items-center justify-center w-8 h-8 p-0 border-0 rounded-[10px] bg-transparent text-[var(--danger)] hover:bg-[var(--danger-soft)] disabled:opacity-40"
                                                    title={isSelf ? 'Leave group' : 'Remove member'}>
                                                {busy ? <Loader2 className="w-[16px] h-[16px] animate-spin" /> : isSelf ? <LogOut className="w-[16px] h-[16px]" /> : <X className="w-[16px] h-[16px]" />}
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>

            <AddMemberModal
                isOpen={showAddMember}
                onClose={() => setShowAddMember(false)}
                conversationId={conversation?._id}
                existingMemberIds={members.map((m) => m.userId)}
            />

            <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        </>
    );
}

function safeSelfId() {
    try { return authStore.getUserId(); } catch { return null; }
}