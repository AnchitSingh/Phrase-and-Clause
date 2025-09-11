/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Type } from '@google/genai';
import React, { useEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

// --- TYPE DEFINITIONS ---
type QuizState = 'idle' | 'loading' | 'active' | 'finished' | 'story';
type Theme = 'light' | 'dark';

interface Question {
  sentence: string;
  options: string[];
  correct_answer: string;
}

// --- HELPER FUNCTIONS ---
const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

// --- REACT COMPONENTS ---

// Component to render markdown content
const StoryRenderer = ({ markdownContent }: { markdownContent: string }) => {
  const storyHtml = useMemo(() => {
    return markdownContent
      .split('\n\n')
      .map(paragraph => {
        if (paragraph.trim() === '') return '';
        
        const processInline = (text: string) => text
          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
          .replace(/__(.*?)__/gim, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gim, '<em>$1</em>')
          .replace(/_(.*?)_/gim, '<em>$1</em>')
          .replace(/\n/g, '<br />');

        // Heading checks
        if (paragraph.startsWith('# ')) return `<h1>${processInline(paragraph.substring(2))}</h1>`;
        if (paragraph.startsWith('## ')) return `<h2>${processInline(paragraph.substring(3))}</h2>`;
        if (paragraph.startsWith('### ')) return `<h3>${processInline(paragraph.substring(4))}</h3>`;
        
        return `<p>${processInline(paragraph)}</p>`;
      })
      .join('');
  }, [markdownContent]);

  return <div className="story-content" dangerouslySetInnerHTML={{ __html: storyHtml }} />;
};

// Component to render the question with the underlined part
const QuestionRenderer = ({ sentence }: { sentence: string }) => {
  const html = sentence.replace(/<underline>(.*?)<\/underline>/g, '<u>$1</u>');
  return <p className="question-text" dangerouslySetInnerHTML={{ __html: html }} />;
};

// Theme Toggle Button Component
const ThemeToggle = ({ theme, onToggle }: { theme: Theme; onToggle: () => void }) => (
  <button
    className="theme-toggle"
    onClick={onToggle}
    aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
  >
    {theme === 'light' ? (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
    )}
  </button>
);


function App() {
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showSolutions, setShowSolutions] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [storyContent, setStoryContent] = useState<string>('');
  const [showPrepositionHighlighting, setShowPrepositionHighlighting] = useState<boolean>(true);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);
  
  useEffect(() => {
    if (quizState === 'loading') {
        const messages = [
            "Analyzing your notes...",
            "Reading the markdown file...",
            "Consulting the AI oracle...",
            "Crafting challenging questions...",
            "Untangling key concepts...",
            "Brewing a fresh batch of quizzes...",
            "Assembling answers...",
            "Generating preposition questions...",
            "Constructing complex sentences...",
            "Analyzing sentence structures...",
            "Weaving a captivating tale...",
            "Building a world of words...",
        ];
        setLoadingMessage(messages[0]); // Set initial message
        let messageIndex = 0;
        const intervalId = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setLoadingMessage(messages[messageIndex]);
        }, 2500); // Change every 2.5 seconds

        return () => clearInterval(intervalId); // Cleanup on state change
    }
  }, [quizState]);
  
  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        if (selectedFile.type === 'text/markdown' || selectedFile.name.endsWith('.md')) {
            setFile(selectedFile);
        } else {
            alert("Please upload a valid markdown (.md) file.");
            setFile(null);
            event.target.value = ''; // Reset the input
        }
    }
  };
  
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content) {
                resolve(content);
            } else {
                reject(new Error("File is empty or could not be read."));
            }
        };
        reader.onerror = () => {
            reject(new Error("Failed to read file."));
        };
        reader.readAsText(file);
    });
  };

  const handleGenerateQuiz = async () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }
    setQuizState('loading');
    try {
      const markdownContent = await readFileContent(file);

      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: {
              type: Type.STRING,
              description: "The full question or sentence with the part to be identified wrapped in <underline> tags (if applicable)."
            },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "An array of 4 options (3 incorrect, 1 correct)."
            },
            correct_answer: {
              type: Type.STRING,
              description: "The correct option from the options array."
            }
          },
          required: ["sentence", "options", "correct_answer"],
          propertyOrdering: ["sentence", "options", "correct_answer"]
        }
      };

      const prompt = `Based on the following text content, generate 10 unique Multiple Choice Questions to test understanding.
      The questions should cover key concepts, definitions, and important information from the text.
      For each question, provide a sentence where the part to be identified is wrapped in <underline> tags (if applicable, otherwise a standard question is fine).
      Also provide one correct answer and three plausible incorrect options.
      Ensure the questions are directly related to the provided text.

      Text Content:
      ---
      ${markdownContent}
      ---`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const parsedQuestions = JSON.parse(response.text);
      
      const questionsWithShuffledOptions = parsedQuestions.map((q: Question) => ({
        ...q,
        options: shuffleArray(q.options),
      }));

      setQuestions(questionsWithShuffledOptions);
      setUserAnswers(new Array(questionsWithShuffledOptions.length).fill(null));
      setCurrentQuestionIndex(0);
      setQuizState('active');

    } catch (error) {
      console.error("Failed to generate quiz:", error);
      alert(`Sorry, there was an error generating the quiz. ${error instanceof Error ? error.message : 'Please try again.'}`);
      setQuizState('idle');
    }
  };

  const handleGeneratePrepositionQuiz = async () => {
    setQuizState('loading');
    try {
      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: {
              type: Type.STRING,
              description: "The full sentence with a blank space where the preposition should be, represented by '<underline>...</underline>'."
            },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "An array of 4 preposition options (3 incorrect, 1 correct)."
            },
            correct_answer: {
              type: Type.STRING,
              description: "The correct preposition from the options array."
            }
          },
          required: ["sentence", "options", "correct_answer"],
          propertyOrdering: ["sentence", "options", "correct_answer"]
        }
      };

      const prompt = `Generate 50 unique Multiple Choice Questions to test a user's understanding of English prepositions.
      The questions should cover a wide variety of preposition uses, such as time, place, direction, and in phrasal verbs.
      For each question, provide a sentence with a blank space where a preposition should be. Use the tag "<underline>...</underline>" to represent this blank space.
      Also provide four preposition options: one that is correct and three that are plausible but incorrect.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const parsedQuestions = JSON.parse(response.text);
      
      const questionsWithShuffledOptions = parsedQuestions.map((q: Question) => ({
        ...q,
        options: shuffleArray(q.options),
      }));

      setQuestions(questionsWithShuffledOptions);
      setUserAnswers(new Array(questionsWithShuffledOptions.length).fill(null));
      setCurrentQuestionIndex(0);
      setQuizState('active');

    } catch (error) {
      console.error("Failed to generate preposition quiz:", error);
      alert(`Sorry, there was an error generating the quiz. ${error instanceof Error ? error.message : 'Please try again.'}`);
      setQuizState('idle');
    }
  };
  
  const handleGenerateFixedPrepositionQuiz = async () => {
    setQuizState('loading');
    try {
      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: {
              type: Type.STRING,
              description: "The full sentence with a blank space where the preposition should be, represented by '<underline>...</underline>'."
            },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "An array of 4 preposition options (3 incorrect, 1 correct)."
            },
            correct_answer: {
              type: Type.STRING,
              description: "The correct preposition from the options array."
            }
          },
          required: ["sentence", "options", "correct_answer"],
          propertyOrdering: ["sentence", "options", "correct_answer"]
        }
      };

      const prompt = `Generate 50 unique Multiple Choice Questions to test a user's understanding of English fixed prepositions.
      Fixed prepositions are common collocations where a verb, noun, or adjective must be followed by a specific preposition.
      For example: 'accustomed to', 'afraid of', 'believe in'.
      The questions should cover a wide variety of these fixed prepositions.
      For each question, provide a sentence with a blank space where the preposition should be. Use the tag "<underline>...</underline>" to represent this blank space.
      Also provide four preposition options: one that is correct and three that are plausible but incorrect.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const parsedQuestions = JSON.parse(response.text);
      
      const questionsWithShuffledOptions = parsedQuestions.map((q: Question) => ({
        ...q,
        options: shuffleArray(q.options),
      }));

      setQuestions(questionsWithShuffledOptions);
      setUserAnswers(new Array(questionsWithShuffledOptions.length).fill(null));
      setCurrentQuestionIndex(0);
      setQuizState('active');

    } catch (error) {
      console.error("Failed to generate fixed preposition quiz:", error);
      alert(`Sorry, there was an error generating the quiz. ${error instanceof Error ? error.message : 'Please try again.'}`);
      setQuizState('idle');
    }
  };

  const handleGenerateSentenceTypeQuiz = async () => {
    setQuizState('loading');
    try {
      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: {
              type: Type.STRING,
              description: "The full sentence that the user needs to classify."
            },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "An array of 4 options: 'Simple', 'Compound', 'Complex', and 'Compound-Complex'."
            },
            correct_answer: {
              type: Type.STRING,
              description: "The correct sentence type from the options array."
            }
          },
          required: ["sentence", "options", "correct_answer"],
          propertyOrdering: ["sentence", "options", "correct_answer"]
        }
      };

      const prompt = `Generate 50 unique Multiple Choice Questions to test a user's ability to identify English sentence types.
      The four possible types are: "Simple", "Compound", "Complex", and "Compound-Complex".
      The questions should cover a wide variety of sentence structures and include some tricky examples to challenge the user.
      For each question, provide the full sentence to be classified.
      Also provide four options (the four sentence types) and identify the correct one.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema,
        },
      });

      const parsedQuestions = JSON.parse(response.text);
      
      const questionsWithShuffledOptions = parsedQuestions.map((q: Question) => ({
        ...q,
        options: shuffleArray(q.options),
      }));

      setQuestions(questionsWithShuffledOptions);
      setUserAnswers(new Array(questionsWithShuffledOptions.length).fill(null));
      setCurrentQuestionIndex(0);
      setQuizState('active');

    } catch (error) {
      console.error("Failed to generate sentence type quiz:", error);
      alert(`Sorry, there was an error generating the quiz. ${error instanceof Error ? error.message : 'Please try again.'}`);
      setQuizState('idle');
    }
  };

  const handleGenerateStory = async () => {
    setQuizState('loading');
    setLoadingMessage("Weaving a captivating tale...");
    try {
      const prompt = `Generate a long, engaging, and interesting story with plots and twists, between 3000 and 5000 words.
The story's vocabulary must be simple and accessible, using common words to ensure the reader is not confused and can focus on the grammatical structures.
The primary goal is to help the reader subconsciously learn English fixed prepositions, particularly those commonly asked in competitive exams like the SSC.
Focus on prepositions that follow specific verbs, nouns, or adjectives (e.g., 'abide by', 'abstain from', 'adept in', 'adhere to', 'fond of', 'detrimental to', 'comply with', 'deal in', 'deal with').
Embed a wide variety of these fixed prepositions naturally throughout the narrative. Use them repetitively but subtly in character dialogue, descriptions, and plot developments.
**Crucially, you must highlight every targeted fixed preposition by making it bold using markdown.** For example, if the fixed preposition is 'fond of', the text should look like 'He was **fond of** music.' or 'She was very **adept in** painting.'
The story should be written in proper markdown format (using paragraphs) and have a clear beginning, middle, and end, with compelling characters and a captivating plot.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setStoryContent(response.text);
      setQuizState('story');

    } catch (error) {
      console.error("Failed to generate story:", error);
      alert(`Sorry, there was an error generating the story. ${error instanceof Error ? error.message : 'Please try again.'}`);
      setQuizState('idle');
    }
  };

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);

    setTimeout(() => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        } else {
            setQuizState('finished');
        }
    }, 300); // Short delay for user to see their selection
  };
  
  const handleStopQuiz = () => {
    setQuizState('finished');
  };

  const handleRestart = () => {
    setQuizState('idle');
    setQuestions([]);
    setUserAnswers([]);
    setCurrentQuestionIndex(0);
    setShowSolutions(false);
    setFile(null);
    setStoryContent('');
    setShowPrepositionHighlighting(true);
  };

  const score = useMemo(() => {
    return userAnswers.reduce((total, answer, index) => {
      if (answer === null) return total;
      if (answer === questions[index]?.correct_answer) {
        return total + 1;
      }
      return total - 0.25;
    }, 0);
  }, [userAnswers, questions]);

  const renderContent = () => {
    switch (quizState) {
      case 'loading':
        return (
          <div className="card">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <p className="loader">{loadingMessage}</p>
          </div>
        );

      case 'active':
        const currentQuestion = questions[currentQuestionIndex];
        return (
          <div className="card">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <div className="quiz-header">
                <span className="question-counter">Question {currentQuestionIndex + 1} / {questions.length}</span>
                <button className="btn btn-secondary" onClick={handleStopQuiz}>Stop Quiz</button>
            </div>
            <QuestionRenderer sentence={currentQuestion.sentence} />
            <div className="options-grid">
              {currentQuestion.options.map((option, i) => (
                <button key={i} className="option-btn" onClick={() => handleAnswerSelect(option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>
        );

      case 'finished':
          const attempted = userAnswers.filter(a => a !== null).length;
          const correct = userAnswers.filter((a, i) => a === questions[i].correct_answer).length;
          const incorrect = attempted - correct;
        return (
          <div className="card">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <h2>Quiz Finished!</h2>
            <p>Here's how you performed.</p>
            <div className="results-grid">
                <div className="result-item"><h3>Score</h3><p>{score.toFixed(2)}</p></div>
                <div className="result-item"><h3>Attempted</h3><p>{attempted}/{questions.length}</p></div>
                <div className="result-item"><h3>Correct</h3><p>{correct}</p></div>
                <div className="result-item"><h3>Incorrect</h3><p>{incorrect}</p></div>
            </div>
            <div>
                <button className="btn btn-primary" onClick={handleRestart}>Restart Quiz</button>
                <button className="btn btn-secondary" onClick={() => setShowSolutions(!showSolutions)}>
                    {showSolutions ? 'Hide Solutions' : 'Show Solutions'}
                </button>
            </div>
            {showSolutions && (
                <div className="solutions-container">
                    <h2>Solutions</h2>
                    {questions.map((q, i) => (
                        <div key={i} className="solution-item">
                            <QuestionRenderer sentence={q.sentence} />
                            <p className={`user-answer ${userAnswers[i] === q.correct_answer ? 'correct' : userAnswers[i] ? 'incorrect' : ''}`}>
                                Your answer: {userAnswers[i] || 'Not Answered'}
                            </p>
                            {userAnswers[i] !== q.correct_answer && userAnswers[i] !== null && (
                                <p className="correct-answer-text">Correct answer: {q.correct_answer}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
          </div>
        );

    case 'story':
        const processedStoryContent = useMemo(() => {
            if (showPrepositionHighlighting) {
                return storyContent;
            }
            return storyContent.replace(/\*\*(.*?)\*\*/g, '$1');
        }, [storyContent, showPrepositionHighlighting]);

        return (
          <div className="card story-card">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <h2 style={{ textAlign: 'center' }}>A Story to Learn By</h2>
            <StoryRenderer markdownContent={processedStoryContent} />
            <div className="button-group">
                <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowPrepositionHighlighting(!showPrepositionHighlighting)}>
                        {showPrepositionHighlighting ? 'Remove Highlighting' : 'Show Highlighting'}
                </button>
                <button className="btn btn-primary" onClick={handleRestart}>Back to Menu</button>
            </div>
          </div>
        );

      case 'idle':
      default:
        return (
          <div className="card">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <h1>Quiz from Markdown</h1>
            <p>Upload your study notes, or practice with a pre-made quiz on prepositions.</p>
             <div className="file-upload-container">
              <input
                type="file"
                id="file-upload"
                accept=".md,text/markdown"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                aria-hidden="true"
              />
              <label htmlFor="file-upload" className="btn btn-secondary">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                {file ? 'Change File' : 'Choose a .md File'}
              </label>
              {file && <span className="file-name">{file.name}</span>}
            </div>
            <div className="button-group">
                <button className="btn btn-primary" onClick={handleGenerateQuiz} disabled={!file}>Generate from File</button>
                <button className="btn btn-secondary" onClick={handleGeneratePrepositionQuiz}>Practice Prepositions</button>
                <button className="btn btn-secondary" onClick={handleGenerateFixedPrepositionQuiz}>Fixed Prepositions</button>
                <button className="btn btn-secondary" onClick={handleGenerateSentenceTypeQuiz}>Sentence Types</button>
                <button className="btn btn-secondary" onClick={handleGenerateStory}>Learn with Stories</button>
            </div>
          </div>
        );
    }
  };

  return renderContent();
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);