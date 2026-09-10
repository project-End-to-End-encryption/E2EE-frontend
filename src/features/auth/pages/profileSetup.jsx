import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, User, Loader2, AlertCircle } from "lucide-react";
import {
    COLORS,
    DISPLAY_FONT,
    AuthPageShell,
    Field,
    inputStyle,
} from "../components/sidepanel";

const CROP_SIZE = 240; // on-screen crop frame, px
const OUTPUT_SIZE = 320; // exported avatar size, px

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const UPLOAD_URL_ENDPOINT = `${API_BASE_URL}/api/v1/users/profile/picture/upload-url`;
const PROFILE_ENDPOINT = `${API_BASE_URL}/api/v1/users/profile`;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// The crop/zoom step shown right after a photo is picked.
function PhotoCropModal({ src, onCancel, onSave }) {
    const imgRef = useRef(null);
    const dragState = useRef(null);
    const [naturalSize, setNaturalSize] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.src = src;
    }, [src]);

    const baseScale = naturalSize
        ? Math.max(CROP_SIZE / naturalSize.width, CROP_SIZE / naturalSize.height)
        : 1;
    const scale = baseScale * zoom;
    const renderedWidth = naturalSize ? naturalSize.width * scale : 0;
    const renderedHeight = naturalSize ? naturalSize.height * scale : 0;

    const clampOffset = (next, width = renderedWidth, height = renderedHeight) => ({
        x: clamp(next.x, CROP_SIZE - width, 0),
        y: clamp(next.y, CROP_SIZE - height, 0),
    });

    useEffect(() => {
        if (!naturalSize) return;
        setOffset(
            clampOffset(
                {
                    x: (CROP_SIZE - naturalSize.width * baseScale) / 2,
                    y: (CROP_SIZE - naturalSize.height * baseScale) / 2,
                },
                naturalSize.width * baseScale,
                naturalSize.height * baseScale,
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [naturalSize]);

    const handleZoomChange = (e) => {
        const nextZoom = Number(e.target.value);
        const nextScale = baseScale * nextZoom;
        const nextWidth = naturalSize.width * nextScale;
        const nextHeight = naturalSize.height * nextScale;
        const ratio = nextScale / scale;
        const cx = offset.x - CROP_SIZE / 2;
        const cy = offset.y - CROP_SIZE / 2;
        setOffset(
            clampOffset(
                { x: cx * ratio + CROP_SIZE / 2, y: cy * ratio + CROP_SIZE / 2 },
                nextWidth,
                nextHeight,
            ),
        );
        setZoom(nextZoom);
    };

    const handlePointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragState.current = {
            startX: e.clientX,
            startY: e.clientY,
            startOffset: offset,
        };
    };

    const handlePointerMove = (e) => {
        if (!dragState.current) return;
        const dx = e.clientX - dragState.current.startX;
        const dy = e.clientY - dragState.current.startY;
        setOffset(
            clampOffset({
                x: dragState.current.startOffset.x + dx,
                y: dragState.current.startOffset.y + dy,
            }),
        );
    };

    const handlePointerUp = () => {
        dragState.current = null;
    };

    const handleSave = () => {
        const canvas = document.createElement("canvas");
        canvas.width = OUTPUT_SIZE;
        canvas.height = OUTPUT_SIZE;
        const ctx = canvas.getContext("2d");
        const sSize = CROP_SIZE / scale;
        const sx = -offset.x / scale;
        const sy = -offset.y / scale;
        ctx.drawImage(
            imgRef.current,
            sx,
            sy,
            sSize,
            sSize,
            0,
            0,
            OUTPUT_SIZE,
            OUTPUT_SIZE,
        );
        canvas.toBlob(
            (blob) => onSave(blob, canvas.toDataURL("image/jpeg", 0.92)),
            "image/jpeg",
            0.92,
        );
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                zIndex: 50,
            }}
            className="flex items-center justify-center px-4"
        >
            <div
                style={{
                    background: COLORS.paper,
                    border: `1px solid ${COLORS.hairline}`,
                }}
                className="w-full max-w-xs rounded p-6"
            >
                <p
                    style={{ color: COLORS.obsidian, fontFamily: DISPLAY_FONT }}
                    className="mb-4 text-center text-base font-medium"
                >
                    Adjust photo
                </p>

                <div
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    style={{
                        width: CROP_SIZE,
                        height: CROP_SIZE,
                        borderRadius: "9999px",
                        overflow: "hidden",
                        margin: "0 auto",
                        background: COLORS.hairline,
                        cursor: "grab",
                        touchAction: "none",
                        position: "relative",
                    }}
                >
                    {naturalSize && (
                        <img
                            ref={imgRef}
                            src={src}
                            alt=""
                            draggable={false}
                            style={{
                                position: "absolute",
                                left: offset.x,
                                top: offset.y,
                                width: renderedWidth,
                                height: renderedHeight,
                                maxWidth: "none",
                                userSelect: "none",
                            }}
                        />
                    )}
                </div>

                <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={handleZoomChange}
                    style={{ accentColor: COLORS.signal }}
                    className="mt-5 w-full"
                />

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 rounded px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                            background: COLORS.paper,
                            color: COLORS.obsidian,
                            border: `1px solid ${COLORS.hairline}`,
                            fontFamily: DISPLAY_FONT,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="flex-1 rounded px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                            background: COLORS.signal,
                            color: COLORS.obsidian,
                            fontFamily: DISPLAY_FONT,
                        }}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ProfileSetup({ onContinue }) {
    const navigate = useNavigate();

    const [fullName, setFullName] = useState("");
    const [bio, setBio] = useState("");
    const [photoPreview, setPhotoPreview] = useState(null);
    const [pendingPhotoSrc, setPendingPhotoSrc] = useState(null);

    // Storage & Async state
    const [profilePictureKey, setProfilePictureKey] = useState(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const fileInputRef = useRef(null);
    const uploadPromiseRef = useRef(null);

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setPendingPhotoSrc(reader.result);
        reader.readAsDataURL(file);
    };

    const closeCropModal = () => {
        setPendingPhotoSrc(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Upload image in background
    const uploadPhotoInBackground = async (file) => {
        setIsUploadingImage(true);
        setErrorMsg("");

        try {
            // 1. Get presigned upload URL from backend
            const res = await fetch(UPLOAD_URL_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    fileName: "avatar.jpeg",  // TODO: need to fix this
                    mimeType: "image/jpeg",
                }),
            });

            const resData = await res.json();
            if (!res.ok || !resData.success) {
                throw new Error(resData.message || "Failed to generate upload URL");
            }

            const { uploadUrl, key } = resData.data;

            // 2. Direct binary PUT upload to MinIO/S3
            const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": "image/jpeg" },
                body: file, // Send binary blob directly
            });

            if (!uploadRes.ok) {
                throw new Error("Failed to upload image file to storage");
            }

            setProfilePictureKey(key);
            return key;
        } catch (err) {
            console.error("Background image upload failed:", err);
            setErrorMsg("Failed to upload photo. Please try choosing another photo.");
            return null;
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleCropSave = (blob, dataUrl) => {
        setPhotoPreview(dataUrl);
        closeCropModal();

        const file = new File([blob], "avatar.jpeg", { type: "image/jpeg" });

        // Start background upload immediately and retain promise
        const promise = uploadPhotoInBackground(file);
        uploadPromiseRef.current = promise;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!fullName.trim() || isSubmitting) return;

        setIsSubmitting(true);
        setErrorMsg("");

        try {
            let keyToSubmit = profilePictureKey;

            // If the image is still uploading in background, wait for it to finish first
            if (uploadPromiseRef.current && !keyToSubmit) {
                keyToSubmit = await uploadPromiseRef.current;
            }

            // Prepare JSON payload according to backend schema
            const payload = {
                fullName: fullName.trim(),
                userBio: bio.trim(),
            };

            if (keyToSubmit) {
                payload.profilePictureKey = keyToSubmit;
            }

            // 3. Complete profile PATCH request
            const res = await fetch(PROFILE_ENDPOINT, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // Send HTTP-only auth cookies
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Redirect to dashboard on successful login
                navigate("/dashboard");
            } else {
                setErrorMsg(data.message || "Login failed. Please check your credentials.");
            }

        } catch (err) {
            console.error("Profile submit error:", err);
            setErrorMsg("An unexpected error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AuthPageShell
            tagline="Make it yours"
            subtext="Add a photo and a few details so people know it's really you."
        >
            <h1
                style={{
                    color: COLORS.obsidian,
                    fontFamily: DISPLAY_FONT,
                    fontSize: "clamp(28px, 4vw, 36px)",
                    letterSpacing: "-0.01em",
                }}
                className="font-medium"
            >
                Set up your profile
            </h1>
            <p
                style={{
                    color: COLORS.midGray,
                    fontFamily: DISPLAY_FONT,
                    fontSize: 15,
                    lineHeight: 1.5,
                }}
                className="mt-2"
            >
                This is what others will see on E2EE.
            </p>

            {errorMsg && (
                <div className="mt-4 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
                <div className="flex justify-center">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            aria-label="Upload profile picture"
                            style={{
                                width: 96,
                                height: 96,
                                borderRadius: "9999px",
                                background: COLORS.paper,
                                border: `1px solid ${COLORS.hairline}`,
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                position: "relative",
                            }}
                        >
                            {photoPreview ? (
                                <img
                                    src={photoPreview}
                                    alt="Profile preview"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <User size={36} style={{ color: COLORS.ash }} />
                            )}

                            {/* Spinner indicator when uploading photo in background */}
                            {isUploadingImage && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <Loader2 size={24} className="animate-spin text-white" />
                                </div>
                            )}
                        </button>

                        <span
                            style={{
                                position: "absolute",
                                right: -2,
                                bottom: -2,
                                width: 30,
                                height: 30,
                                borderRadius: "9999px",
                                background: COLORS.signal,
                                color: COLORS.obsidian,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: `2px solid ${COLORS.paper}`,
                                pointerEvents: "none",
                            }}
                        >
                            <Camera size={14} />
                        </span>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoChange}
                            className="hidden"
                        />
                    </div>
                </div>

                <Field label="Full name">
                    <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        className="wisp-login-input rounded px-4 py-3 text-sm transition-colors duration-150"
                        style={inputStyle}
                    />
                </Field>

                <Field label="Bio">
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell people a little about yourself"
                        rows={3}
                        className="wisp-login-input resize-none rounded px-4 py-3 text-sm transition-colors duration-150"
                        style={inputStyle}
                    />
                </Field>

                <button
                    type="submit"
                    disabled={!fullName.trim() || isSubmitting}
                    className="mt-2 flex items-center justify-center gap-2 rounded px-6 py-3.5 text-base font-medium transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    style={{
                        background: COLORS.signal,
                        color: COLORS.obsidian,
                        fontFamily: DISPLAY_FONT,
                    }}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            <span>Saving profile...</span>
                        </>
                    ) : (
                        <span>Continue</span>
                    )}
                </button>

                {/* Dummy navigation / Skip link */}
                <div className="mt-2 text-center">
                    <Link
                        to="/"
                        style={{ color: COLORS.midGray, fontFamily: DISPLAY_FONT }}
                        className="text-xs transition-colors hover:underline hover:text-white"
                    >
                        Skip for now &rarr; Go to Home
                    </Link>
                </div>
            </form>

            {pendingPhotoSrc && (
                <PhotoCropModal
                    src={pendingPhotoSrc}
                    onCancel={closeCropModal}
                    onSave={handleCropSave}
                />
            )}
        </AuthPageShell>
    );
}