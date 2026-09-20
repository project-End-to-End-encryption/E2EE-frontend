import React from 'react';
import { Lock, Phone, Bookmark } from 'lucide-react';

import E2ELogoSVG from '../../../../assets/E2EE.svg';

const PLACEHOLDERS = {
    calls: { Icon: Phone, title: 'Calls are coming soon', text: 'Voice and video calls will show up here.' },
    saved: { Icon: Bookmark, title: 'Saved is coming soon', text: 'Messages you save will show up here.' }
};

/**
 * WelcomeCanvas
 *
 * What the main pane shows when no conversation is open: the same four
 * hand-lettered callouts and logo block as before, on the shared chat wall.
 * The wall itself, and every colour here, come from chat.css - light and dark
 * are the same markup.
 */
export default function WelcomeCanvas({ activeTab = 'chat' }) {
    if (activeTab !== 'chat') {
        const { Icon, title, text } = PLACEHOLDERS[activeTab] ?? {
            Icon: Lock, title: 'Nothing here yet', text: 'This section is not available yet.'
        };

        return (
            <main className="ec-welcome">
                <div className="ec-soon">
                    <span className="ec-empty__icon"><Icon /></span>
                    <h2>{title}</h2>
                    <p>{text}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="ec-welcome">
            <p className="ec-callout c1" aria-hidden="true">Good<br />Conversations<br />Better People</p>
            <p className="ec-callout c2" aria-hidden="true">Private<br />Today<br />Safer<br />Tomorrow</p>
            <p className="ec-callout c3" aria-hidden="true">Ideas<br />Connect<br />People</p>
            <p className="ec-callout c4" aria-hidden="true">Chat<br />Securely</p>

            <div className="ec-welcome__hero">
                <img src={E2ELogoSVG} alt="" className="ec-welcome__logo" />
                <h1 className="ec-welcome__mark">E<b>2</b>EE</h1>
                <h3 className="ec-welcome__tag">Chat Beyond Limits</h3>
                <p className="ec-welcome__text">
                    Start a new conversation and discover a more connected you.
                </p>
                <span className="ec-welcome__lock">
                    <Lock aria-hidden="true" />
                    Messages are end-to-end encrypted
                </span>
            </div>
        </main>
    );
}
