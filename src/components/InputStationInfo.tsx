import { TextInput, Button } from "@mantine/core";
import { useState, type ChangeEvent } from "react";

type Test = {
  text: string;
  text2: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

const InputStationInfo: React.FC<Test> = (props) => {
  const [text2, setText2] = useState(props.text2);

  const handleReset = () => {
    setText2("");
    const event = {
      target: { name: "text2", value: "" },
    } as ChangeEvent<HTMLInputElement>;
    props.onChange(event);
  };

  return (
    <>
      <TextInput name="text" value={props.text} onChange={props.onChange} />
      <TextInput
        name="text2"
        value={text2}
        onChange={(e) => {
          props.onChange(e);
          setText2(e.target.value);
        }}
      />
      <Button variant="filled" onClick={handleReset}>
        Reset Text2
      </Button>
    </>
  );
};

export default InputStationInfo;
