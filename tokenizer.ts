'use strict';

import fs from 'fs';
import path from 'path';
import vntk from 'vntk';
const util = vntk.util();

class Tokenizer {
    private static instance: Tokenizer;

    private tokenizer: any;
    private posTagger: any;
    private ner: any;
    private chunking: any;
    private stop_words: Set<string>;

    private constructor() {
        this.tokenizer = vntk.wordTokenizer();
        this.posTagger = vntk.posTag();
        this.ner = vntk.ner();
        this.chunking = vntk.chunking();

        this.stop_words = new Set(
            fs.readFileSync(path.join(__dirname, '../src/vietnamese-stopwords.txt'), 'utf8')
                .split('\n')
                .map(word => word.trim())
                .filter(word => word.length > 0)
        );
    }

    public static getInstance(): Tokenizer {
        if (!Tokenizer.instance) {
            Tokenizer.instance = new Tokenizer();
        }
        return Tokenizer.instance;
    }

    isStopword(word: string): boolean {
        return this.stop_words.has(word.toLowerCase());
    }

    normalize(text: string): string {
        return util.clean_html(text).toLowerCase().replace(/[/.!?#!$%^&*;:{}=\-_`~()]/g, '');
    }

    removeStopwords(words: string[]): string[] {
        return words.filter(word => !this.isStopword(word));
    }

    public tokenize(text: string): string[] {
        return this.tokenizer.tag(text);
    }

    public posTagging(text: string): [string, string][] {
        return this.posTagger.tag(text);
    }

    public extractNamedEntities(text: string): any[] {
        return this.ner.tag(text);
    }

    private splitSentences(text: string): string[] {
        return text.split(/(?<=[.!?])\s+/).filter(sentence => sentence.trim().length > 0);
    }

    public nounPhrases(text: string): string[] {
        const sentences = this.splitSentences(text);
        const allNounPhrases: string[] = [];
    
        sentences.forEach(sentence => {
            const normalizedText = this.normalize(sentence);
            const chunks: [string, string, string][] = this.chunking.tag(normalizedText);
            const nounPhrases: string[] = [];
            let currentPhrase = '';
    
            for (let index = 0; index < chunks.length; index++) {
                const [word, tag, label] = chunks[index];
                const previousChunks = chunks.slice(0, index);
    
                if (this.isNounPhrase(label)) {
                    if (currentPhrase) {
                        currentPhrase += ' ' + word;
                    } else {
                        currentPhrase = word;
                    }
    
                    if (index === chunks.length - 1 || !this.isNounPhrase(chunks[index + 1][2])) {
                        nounPhrases.push(currentPhrase);
                        currentPhrase = '';
                    }
                } else {
                    if (currentPhrase) {
                        let validPhrase = true;
                        for (let i = previousChunks.length - 1; i >= 0; i--) {
                            if (this.isNounPhrase(previousChunks[i][2])) {
                                currentPhrase = previousChunks[i][0] + ' ' + currentPhrase;
                            } else {
                                validPhrase = false;
                                break;
                            }
                        }
    
                        if (validPhrase) {
                            nounPhrases.push(currentPhrase);
                        }
                        currentPhrase = '';
                    }
                }
            }
    
            allNounPhrases.push(...this.removeStopwords(nounPhrases));
        });
    
        return this.getLongestNounPhrases(allNounPhrases);
    }
    

    private isNounPhrase(phrase: string): boolean {
        return ['B-NP', 'I-NP'].includes(phrase);
    }

    private getLongestNounPhrases(phrases: string[]): string[] {
        const sortedPhrases = phrases.sort((a, b) => b.length - a.length);
        const longestPhrases = new Set<string>();

        sortedPhrases.forEach(phrase => {
            let isSubset = false;
            longestPhrases.forEach(existingPhrase => {
                if (existingPhrase.includes(phrase)) {
                    isSubset = true;
                }
            });
            if (!isSubset) {
                longestPhrases.add(phrase);
            }
        });
        return Array.from(longestPhrases);
    }
}

export default Tokenizer;
