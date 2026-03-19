import json
from datetime import datetime
from typing import Dict, List, Any, Optional

# Configuration
input_file = r"C:\Users\shubh\Desktop\desktop\Data Duta\Claude Exports\csedtusv Exports\csedtusv data-2025-08-01-17-10-48-batch-0000\conversations.json"
output_file = r"C:\Users\shubh\Desktop\Calendar_By_Kla\simplified_claudeCSEDTUSV.json"

def parse_claude_export(data: List[Dict]) -> List[Dict]:
    """
    Parse Claude conversation export and convert to simplified format.
    
    Args:
        data: List of Claude conversation objects
        
    Returns:
        List of simplified conversation objects
    """
    simplified_conversations = []
    
    for conversation in data:
        simplified = {
            "id": conversation.get("uuid", ""),
            "title": conversation.get("name", "Untitled Conversation"),
            "source": "claude",
            "account": "csedtusv",
            "created_at": conversation.get("created_at", ""),
            "updated_at": conversation.get("updated_at", ""),
            "messages": []
        }
        
        # Process chat messages
        for msg in conversation.get("chat_messages", []):
            # Skip if no meaningful content
            if not msg.get("text") and not msg.get("content"):
                continue
                
            sender = msg.get("sender", "")
            # Normalize role
            role = "user" if sender == "human" else "assistant"
            
            # Extract main content and detect type
            message_obj = {
                "id": msg.get("uuid", ""),
                "role": role,
                "content": "",
                "content_type": "text",
                "timestamp": msg.get("created_at", ""),
                "metadata": {},
                "parent_id": None
            }
            
            # Process content blocks
            content_parts = []
            has_code = False
            has_artifact = False
            artifact_info = {}
            citations = []
            
            for block in msg.get("content", []):
                block_type = block.get("type", "")
                
                if block_type == "text":
                    text_content = block.get("text", "")
                    if text_content:
                        content_parts.append(text_content)
                    
                    # Collect citations if present
                    block_citations = block.get("citations", [])
                    if block_citations:
                        citations.extend(block_citations)
                
                elif block_type == "tool_use":
                    # Check if it's an artifact
                    tool_name = block.get("name", "")
                    if tool_name == "artifacts":
                        has_artifact = True
                        tool_input = block.get("input", {})
                        
                        artifact_info = {
                            "title": tool_input.get("title", ""),
                            "language": tool_input.get("language", ""),
                            "artifact_type": tool_input.get("type", "")
                        }
                        
                        # Add artifact content
                        artifact_content = tool_input.get("content", "")
                        if artifact_content:
                            content_parts.append(f"\n\n```{artifact_info.get('language', '')}\n{artifact_content}\n```")
            
            # Combine all content parts
            message_obj["content"] = "\n".join(content_parts)
            
            # Determine content type
            if has_artifact:
                if artifact_info.get("artifact_type") == "application/vnd.ant.code":
                    message_obj["content_type"] = "code"
                else:
                    message_obj["content_type"] = "artifact"
                
                # Add metadata
                if artifact_info.get("language"):
                    message_obj["metadata"]["language"] = artifact_info["language"]
                if artifact_info.get("title"):
                    message_obj["metadata"]["title"] = artifact_info["title"]
            elif "```" in message_obj["content"]:
                message_obj["content_type"] = "code"
                # Try to extract language from code block
                import re
                match = re.search(r'```(\w+)', message_obj["content"])
                if match:
                    message_obj["metadata"]["language"] = match.group(1)
            
            # Add citations if any
            if citations:
                message_obj["metadata"]["citations"] = citations
            
            # Clean up empty metadata
            if not message_obj["metadata"]:
                del message_obj["metadata"]
            else:
                # Keep only non-empty metadata fields
                message_obj["metadata"] = {k: v for k, v in message_obj["metadata"].items() if v}
            
            # Only add if has content
            if message_obj["content"].strip():
                simplified["messages"].append(message_obj)
        
        simplified_conversations.append(simplified)
    
    return simplified_conversations


def simplify_claude_export(input_path: str, output_path: str):
    """
    Main function to simplify Claude export.
    
    Args:
        input_path: Path to Claude export JSON file
        output_path: Path to save simplified JSON
    """
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        simplified = parse_claude_export(data)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(simplified, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully simplified {len(simplified)} conversations")
        print(f"Output saved to: {output_path}")
        
        total_messages = sum(len(conv["messages"]) for conv in simplified)
        print(f"Total messages: {total_messages}")
        
    except FileNotFoundError:
        print(f"Error: File '{input_path}' not found")
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in '{input_path}'")
    except Exception as e:
        print(f"Error: {str(e)}")


if __name__ == "__main__":
    simplify_claude_export(input_file, output_file)