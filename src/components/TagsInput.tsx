'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

const TAG_PATTERN = /^[a-zA-Z0-9_-]*$/;
const MAX_TAGS = 10;
const WARNING_DURATION_MS = 1800;

export interface TagsInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
}

export default function TagsInput({ tags, onChange, placeholder }: TagsInputProps) {
    const [inputValue, setInputValue] = useState('');
    const [warning, setWarning] = useState<string | null>(null);
    const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (warningTimer.current) clearTimeout(warningTimer.current);
        };
    }, []);

    function flashWarning(message: string) {
        setWarning(message);
        if (warningTimer.current) clearTimeout(warningTimer.current);
        warningTimer.current = setTimeout(() => setWarning(null), WARNING_DURATION_MS);
    }

    function commitTag(raw: string) {
        const tag = raw.trim();
        setInputValue('');
        if (!tag) return;
        if (tags.includes(tag)) {
            flashWarning(`« ${tag} » est déjà présent`);
            return;
        }
        if (tags.length >= MAX_TAGS) {
            flashWarning(`Maximum ${MAX_TAGS} tags`);
            return;
        }
        onChange([...tags, tag]);
    }

    function removeTag(index: number) {
        onChange(tags.filter((_, i) => i !== index));
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value;

        if (value.endsWith(' ')) {
            commitTag(value.slice(0, -1));
            return;
        }

        if (!TAG_PATTERN.test(value)) {
            flashWarning('Seuls les lettres, chiffres, - et _ sont autorisés');
            return;
        }

        setInputValue(value);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitTag(inputValue);
        } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
            removeTag(tags.length - 1);
        }
    }

    return (
        <div className="relative">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-200 bg-white p-2 transition-colors focus-within:border-zinc-400">
                {tags.map((tag, i) => (
                    <span
                        key={`${tag}-${i}`}
                        className="flex items-center gap-1 rounded-lg bg-zinc-100 py-1 pl-2 pr-1 text-xs font-medium text-zinc-700"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => removeTag(i)}
                            className="rounded px-1 text-zinc-400 hover:text-zinc-700"
                            aria-label={`Retirer le tag ${tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    className="min-w-[6rem] flex-1 border-none bg-transparent p-1 text-sm text-zinc-900 caret-zinc-900 outline-none"
                    placeholder={tags.length === 0 ? placeholder : ''}
                    value={inputValue}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onBlur={() => commitTag(inputValue)}
                />
            </div>
            {warning && (
                <div className="absolute left-0 top-full z-10 mt-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg">
                    {warning}
                </div>
            )}
        </div>
    );
}
