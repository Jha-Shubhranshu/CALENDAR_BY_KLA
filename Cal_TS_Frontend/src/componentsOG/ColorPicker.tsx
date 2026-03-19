import { COLORS } from '../constants/colorsOG';

interface ColorPickerPropsSchema {
    onSelectColor: (color: string) => void;
    onClose: () => void;
}

export function ColourPicker({onSelectColor, onClose}: ColorPickerPropsSchema) {

    return (
        <div className='absolute bg-white rounded-lg shadow-lg p-2 flex gap-1 z-20'>
            {COLORS.map(color => (
                <button key={color.value} className='w-8 h-8 rounded-full border-2 hover:border-gray-600' style={{ backgroundColor: color.value }} onClick={()=>{onSelectColor(color.value); onClose();}} title={color.name}/>
            ))}
        </div>
    )
}