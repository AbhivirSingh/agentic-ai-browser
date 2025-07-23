import os
from pydantic import BaseModel, Field
from pydantic.types import SecretStr
from dotenv import load_dotenv
from agents import (
    Agent,
    RunContextWrapper,
    Runner,
    function_tool,
    add_trace_processor,
    TResponseInputItem
)

import asyncio
from maxim import Maxim, Config
from maxim.logger.openai.agents import MaximOpenAIAgentsTracingProcessor
from agent.agent import Agent as BrowserAgent
from computers.default import LocalPlaywrightBrowser

load_dotenv()

logger = Maxim(Config(api_key=os.getenv("MAXIM_API_KEY"))).logger()
add_trace_processor(MaximOpenAIAgentsTracingProcessor(logger))

class ProductComparisonContext(BaseModel):
    """
    Context for product comparison.
    """
    product1: str = Field(default='', description="Name of the first product")
    product2: str = Field(default='', description="Name of the second product")
    product1Features: str = Field(default='', description="Features of the first product")
    product2Features: str = Field(default='', description="Features of the second product")
    markdownString: str = Field(default='', description="the markdown string to display the comparison")

@function_tool(
    name_override= "online_search",
    description_override= "Search the web for information about a product.",
)

async def online_search(
    context: RunContextWrapper[ProductComparisonContext],
    query: str) -> str:

    try:
        with LocalPlaywrightBrowser() as computer:
            agent = BrowserAgent(
                computer=computer,
            )
            items = []
            items.append({
                "role": "user",
                "content": query
            })
            output_items = agent.run_full_turn(
                items, debug= True, show_images=False
            )
            items+=output_items
        if context.context.product1 == '':
            context.context.product1Features = items[-1]['content']
        elif context.context.product2 == '':
            context.context.product2Features = items[-1]['content']
    except Exception as e:
        return F"Error: {e}"

triage_agent = Agent[ProductComparisonContext](
    name = "Online Search Agent",
    handoff_description = "An agent that searches the web for product information.",
    instructions= ("Use this agent to search the web for information about products. "
     "It will return the features of the product you searched for."
    ),model= "gpt-4o",
    tools=[online_search],
)

async def main():
    context = ProductComparisonContext()
    product1 = input("Enter the name of the first product: ")
    product2 = input("Enter the name of the second product: ")
    context.product1 = product1
    context.product2 = product2

    # Search for product 1 features
    input_items1: list[TResponseInputItem] = [{
        "role": "user",
        "content": f"Search for the features of {product1}."
    }]
    result1 = await Runner.run(
        triage_agent,
        input_items1,
        context=context
    )
    context.product1Features = result1.final_output if hasattr(result1, 'final_output') else str(result1)

    # Search for product 2 features
    input_items2: list[TResponseInputItem] = [{
        "role": "user",
        "content": f"Search for the features of {product2}."
    }]
    result2 = await Runner.run(
        triage_agent,
        input_items2,
        context=context
    )
    context.product2Features = result2.final_output if hasattr(result2, 'final_output') else str(result2)

    # Optionally, compare and format the results
    comparison = f"# Product Comparison\n\n## {product1}\n{context.product1Features}\n\n## {product2}\n{context.product2Features}\n"
    print(comparison)
    with open("result.md", "w") as f:
        f.write(comparison)

if __name__ == "__main__":
    asyncio.run(main())
