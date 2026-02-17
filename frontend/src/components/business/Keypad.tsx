interface KeypadProps {
    onKeyPress: (key: string) => void;
    onClear: () => void;
    onEnter: () => void;
    amount: string;
}

export function Keypad({ onKeyPress, onClear, onEnter, amount }: KeypadProps) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'Ent'];

    return (
        <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
            {keys.map((key) => (
                <button
                    key={key}
                    onClick={() => {
                        if (key === 'C') onClear();
                        else if (key === 'Ent') onEnter();
                        else onKeyPress(key);
                    }}
                    disabled={key === 'Ent' && (!amount || parseFloat(amount) <= 0)}
                    className={`
            h-20 text-2xl font-medium rounded-2xl transition-all active:scale-95
            ${key === 'Ent'
                            ? 'bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500'
                            : key === 'C'
                                ? 'bg-red-900/30 text-red-200 hover:bg-red-900/50'
                                : 'bg-gray-800 text-white hover:bg-gray-700'}
          `}
                >
                    {key === 'Ent' ? 'Pay' : key}
                </button>
            ))}
        </div>
    );
}
