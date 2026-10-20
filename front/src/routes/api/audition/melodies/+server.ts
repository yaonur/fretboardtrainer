import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	canonicalLibrary,
	isBarCount,
	libraryIssues,
	normalizeLibrary
} from '$lib/audition/notation';
import type { RequestHandler } from './$types';

function melodyDir(): string {
	const fromCwd = path.resolve('src/lib/audition/melodies');
	if (existsSync(fromCwd)) return fromCwd;
	return fileURLToPath(new URL('../../../../lib/audition/melodies', import.meta.url));
}

function fileForBars(bars: number): string | null {
	if (!isBarCount(bars)) return null;
	const file = path.join(melodyDir(), `${bars}-bar.json`);
	const root = path.resolve(melodyDir());
	if (!file.startsWith(root)) return null;
	return file;
}

export const GET: RequestHandler = async ({ url }) => {
	const bars = Number(url.searchParams.get('bars'));
	const file = fileForBars(bars);
	if (!file) error(400, 'bars must be 1, 2, 3, or 4');
	const text = await readFile(file, 'utf8');
	return json(normalizeLibrary(JSON.parse(text)));
};

export const PUT: RequestHandler = async ({ request }) => {
	if (!dev) {
		return json(
			{ message: 'Melody files can only be saved while the dev server is running' },
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Expected a JSON library' }, { status: 400 });
	}

	let library;
	try {
		library = canonicalLibrary(normalizeLibrary(body));
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : 'Invalid library';
		return json({ message }, { status: 400 });
	}

	const issues = libraryIssues(library);
	if (issues.length > 0) {
		return json({ message: issues.join(' ') }, { status: 400 });
	}

	const file = fileForBars(library.bars);
	if (!file) return json({ message: 'bars must be 1, 2, 3, or 4' }, { status: 400 });

	await writeFile(file, `${JSON.stringify(library, null, '\t')}\n`, 'utf8');
	return json(library);
};
