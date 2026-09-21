import React from 'react';
import { X, Image, FileText, Video } from 'lucide-react';
import Avatar from '../../../../components/common/Avatar.jsx';

export default function ChatInfoSidebar({ isOpen, onClose, conversation }) {
    if (!isOpen) return null;

    const isGroup = conversation?.type === 'group';
    const name = conversation?.displayName || 'Conversation';
    const peer = conversation?.peer;

    return (
        <>
            <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 bottom-0 w-full max-w-[400px] bg-[var(--surface)] border-l border-[var(--line)] z-50 overflow-y-auto">
                <div className="sticky top-0 flex items-center justify-between px-5 py-4 bg-[var(--glass-strong)] border-b border-[var(--line)]">
                    <h2 className="m-0 font-semibold text-[17px] text-[var(--ink)]">Contact Info</h2>
                    <button type="button" onClick={onClose} className="inline-flex items-center justify-center w-9 h-9 p-0 border-0 rounded-[12px] bg-transparent text-[var(--ink-2)] hover:bg-[var(--surface-3)]">
                        <X className="w-[20px] h-[20px]" />
                    </button>
                </div>

                <div className="flex flex-col items-center gap-3 px-5 py-8 border-b border-[var(--line)]">
                    <Avatar name={name} seed={conversation?._id} profilePictureKey={peer?.profilePictureKey} group={isGroup} size={120} />
                    <div className="text-center">
                        <h3 className="m-0 mb-1 font-semibold text-[20px] text-[var(--ink)]">{name}</h3>
                        {!isGroup && peer?.username && <p className="m-0 text-[14px] text-[var(--ink-2)]">@{peer.username}</p>}
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
                        <h4 className="m-0 mb-3 font-semibold text-[14px] text-[var(--ink-2)] uppercase">Members</h4>
                        <p className="text-[13px] text-[var(--ink-3)]">{conversation?.memberIds?.length || 0} members</p>
                    </div>
                )}
            </div>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        </>
    );
}