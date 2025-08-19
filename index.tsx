/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Type } from '@google/genai';
import { useEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

// --- TYPE DEFINITIONS ---
type QuizState = 'idle' | 'loading' | 'active' | 'finished';

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

// Component to render the question with the underlined part
const QuestionRenderer = ({ sentence }: { sentence: string }) => {
  const html = sentence.replace(/<underline>(.*?)<\/underline>/g, '<u>$1</u>');
  return <p className="question-text" dangerouslySetInnerHTML={{ __html: html }} />;
};

function App() {
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showSolutions, setShowSolutions] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);
  
  useEffect(() => {
    if (quizState === 'loading') {
        const messages = [
            "Conjuring challenging questions...",
            "Mixing nouns and verbs...",
            "Consulting the grammar oracle...",
            "Sharpening the pencils...",
            "Untangling sentence structures...",
            "Brewing a fresh batch of clauses...",
            "Waking up the adverbs...",
            "Assembling phrases piece by piece..."
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

  const handleStartQuiz = async () => {
    setQuizState('loading');
    try {
      const responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sentence: {
              type: Type.STRING,
              description: "The full sentence with the part to be identified wrapped in <underline> tags."
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

      const prompt = `Generate 50 unique Multiple Choice Questions for an English grammar quiz.
      The topic is identifying phrases and clauses (e.g., Noun Phrase, Adjective Clause, Adverb Phrase, etc.).
      The difficulty level should be suitable for the SSC CGL exam (mixed difficulty).
      For each question, provide a sentence where the part to be identified is wrapped in <underline> tags.
      Also provide one correct answer and three plausible incorrect options.
      Ensure the options are distinct types of phrases or clauses.`;

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
      alert("Sorry, there was an error generating the quiz. Please try again.");
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
        return <div className="card"><p className="loader">{loadingMessage}</p></div>;

      case 'active':
        const currentQuestion = questions[currentQuestionIndex];
        return (
          <div className="card">
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

      case 'idle':
      default:
        return (
          <div className="card">
            <h1>English Grammar Quiz</h1>
            <p>Identify the type of phrase or clause. Test your skills with 50 challenging questions.</p>
            <button className="btn btn-primary" onClick={handleStartQuiz}>Start Quiz</button>
          </div>
        );
    }
  };

  return renderContent();
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);